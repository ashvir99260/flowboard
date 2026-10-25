import { setTimeout as delay } from 'node:timers/promises';

import type { DeploymentConfig, ReleasedDeployment } from './deploy.js';

interface ProviderOptions {
  assertCurrent: () => Promise<void>;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

interface Project {
  accountId: string;
  framework: string;
  id: string;
  link?: { repoId?: number | string; type: string };
  name: string;
  rootDirectory?: string | null;
}

interface Deployment {
  gitSource?: { repoId?: number | string; sha?: string; type: string };
  id?: string;
  lambdas?: { id: string; readyState?: string }[];
  meta?: Record<string, string>;
  projectId?: string;
  readyState?: string;
  services?: {
    framework?: string;
    name: string;
    runtime?: string;
  }[];
  state?: string;
  target?: string | null;
  uid?: string;
  url?: string;
}

interface Daemon {
  deploymentId?: string;
  instances?: {
    desired: number;
    items: { alive?: boolean; region: string; stoppedAt?: string }[];
    ready: number;
    total: number;
  };
  name: string;
  scope: { type: string; value: string };
  status: string;
}

const requiredEnvironment = [
  'PORT',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'REDIS_URL',
  'AUTH_SECRET',
  'AUTH_ALLOWED_ORIGINS',
  'WEB_ALLOWED_ORIGINS',
  'REALTIME_PUBLIC_URL',
];
const failedStates = ['ERROR', 'CANCELED', 'BLOCKED'];

export function createDeploymentProviders(config: DeploymentConfig, options: ProviderOptions) {
  const request = async <T>(url: string, method = 'GET', body?: unknown): Promise<T> => {
    const response = await (options.fetch ?? fetch)(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${config.vercelToken}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Deployment provider ${method} failed (${response.status})`);

    try {
      return (await response.json()) as T;
    } catch {
      throw new Error('Invalid deployment provider response');
    }
  };
  const wait = async (check: () => Promise<boolean>) => {
    const start = (options.now ?? Date.now)();
    while (true) {
      if (await check()) return;

      if ((options.now ?? Date.now)() - start >= (options.timeoutMs ?? 900_000))
        throw new Error('Deployment readiness timed out');

      await (options.sleep ?? delay)(5_000);
    }
  };
  const vercelUrl = (path: string, query: Record<string, string> = {}) => {
    const url = new URL(`https://api.vercel.com${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    if (config.vercelTeamId) url.searchParams.set('teamId', config.vercelTeamId);

    return url.toString();
  };
  // Daemons have separate live inventory; deployment.services contains HTTP services only.
  const workerReady = async (deploymentId: string): Promise<boolean> => {
    let cursor = '';
    const cursors = new Set<string>();
    do {
      const page = await request<{ daemons: Daemon[]; pagination?: { next?: string } }>(
        vercelUrl(`/v1/projects/${encodeURIComponent(config.vercelProjectId!)}/daemons`, {
          limit: '100',
          scopeType: 'target',
          scopeValue: 'production',
          ...(cursor ? { cursor } : {}),
        }),
      );
      if (!Array.isArray(page.daemons)) throw new Error('Invalid Vercel daemon inventory');

      const worker = page.daemons.find(
        (daemon) =>
          daemon.name === 'worker' &&
          daemon.deploymentId === deploymentId &&
          daemon.scope?.type === 'target' &&
          daemon.scope.value === 'production',
      );
      if (worker)
        return (
          worker.status === 'ready' &&
          worker.instances?.desired === 1 &&
          worker.instances.ready === 1 &&
          worker.instances.total >= 1 &&
          Array.isArray(worker.instances.items) &&
          worker.instances.items.some(
            (instance) =>
              instance.alive === true && instance.region === 'iad1' && !instance.stoppedAt,
          )
        );

      cursor = page.pagination?.next ?? '';
      if (cursor && cursors.has(cursor)) throw new Error('Repeated Vercel daemon cursor');

      if (cursor) cursors.add(cursor);
    } while (cursor);

    return false;
  };

  return {
    async vercel(source: ReleasedDeployment) {
      const projectPath = `/v9/projects/${encodeURIComponent(config.vercelProjectId!)}`;
      const project = await request<Project>(vercelUrl(projectPath));
      if (
        !project.name ||
        project.id !== config.vercelProjectId ||
        project.accountId !== config.vercelTeamId ||
        project.framework !== 'services' ||
        (project.rootDirectory != null && project.rootDirectory !== '') ||
        project.link?.type !== 'github' ||
        String(project.link.repoId) !== config.githubRepoId
      )
        throw new Error('Invalid Vercel Services project configuration');

      const team = await request<{ billing?: { plan: string } | null; id: string }>(
        `https://api.vercel.com/v2/teams/${encodeURIComponent(config.vercelTeamId!)}`,
      );
      if (team.id !== config.vercelTeamId || team.billing?.plan !== 'hobby')
        throw new Error('Vercel deployment requires the configured Hobby account');

      const environment = await request<{
        envs: { key: string; target?: string | string[] }[];
      }>(
        vercelUrl(`/v10/projects/${encodeURIComponent(config.vercelProjectId!)}/env`, {
          decrypt: 'false',
        }),
      );
      if (!Array.isArray(environment.envs)) throw new Error('Invalid Vercel environment response');

      const productionKeys = new Set(
        environment.envs
          .filter(
            ({ target }) =>
              target === 'production' || (Array.isArray(target) && target.includes('production')),
          )
          .map(({ key }) => key),
      );
      for (const key of requiredEnvironment)
        if (!productionKeys.has(key))
          throw new Error(`Missing Vercel production environment: ${key}`);

      const meta = { flowboardSha: source.sha, flowboardTags: source.tags.join(',') };
      const matches = (deployment: Deployment) =>
        deployment.target === 'production' &&
        deployment.meta?.flowboardSha === meta.flowboardSha &&
        deployment.meta?.flowboardTags === meta.flowboardTags;
      let existing: Deployment | undefined;
      let until = '';
      const cursors = new Set<string>();
      do {
        const page = await request<{
          deployments: Deployment[];
          pagination?: { next?: number | null };
        }>(
          vercelUrl('/v7/deployments', {
            projectId: config.vercelProjectId!,
            target: 'production',
            sha: source.sha,
            limit: '100',
            ...(until ? { until } : {}),
          }),
        );
        if (!Array.isArray(page.deployments)) throw new Error('Invalid Vercel deployment listing');

        existing = page.deployments.find(
          (deployment) =>
            matches(deployment) &&
            !failedStates.includes(deployment.state ?? deployment.readyState ?? ''),
        );
        const next = page.pagination?.next;
        until = next ? String(next) : '';
        if (until && cursors.has(until)) throw new Error('Repeated Vercel pagination cursor');

        if (until) cursors.add(until);
      } while (!existing && until);
      if (!existing) {
        await options.assertCurrent();
        existing = await request<Deployment>(vercelUrl('/v13/deployments'), 'POST', {
          name: project.name,
          project: config.vercelProjectId,
          target: 'production',
          projectSettings: { framework: 'services', rootDirectory: null },
          gitSource: {
            type: 'github',
            repoId: config.githubRepoId,
            ref: source.sha,
            sha: source.sha,
          },
          meta,
        });
      }

      const id = existing.id ?? existing.uid;
      if (!id) throw new Error('Vercel did not return a deployment ID');

      let readyUrl = '';
      await wait(async () => {
        await options.assertCurrent();
        // Git identity is opt-in: the default deployment response omits gitSource.
        const deployment = await request<Deployment>(
          vercelUrl(`/v13/deployments/${encodeURIComponent(id)}`, { withGitRepoInfo: 'true' }),
        );
        if (failedStates.includes(deployment.readyState ?? ''))
          throw new Error('Vercel deployment failed');

        if (
          !matches(deployment) ||
          deployment.projectId !== config.vercelProjectId ||
          deployment.gitSource?.type !== 'github' ||
          deployment.gitSource.sha !== source.sha ||
          String(deployment.gitSource.repoId) !== config.githubRepoId
        )
          throw new Error('Invalid Vercel deployment identity');

        if (deployment.readyState !== 'READY') return false;

        const services = deployment.services;
        if (
          !Array.isArray(services) ||
          !services.some((service) => service.name === 'web' && service.framework === 'nextjs') ||
          !services.some((service) => service.name === 'api' && service.runtime === 'container') ||
          !Array.isArray(deployment.lambdas) ||
          !deployment.lambdas.length ||
          !deployment.lambdas.every((build) => build.readyState === 'READY')
        )
          throw new Error('Invalid Vercel Services deployment topology');

        const url = deployment.url;
        if (!url || !/^[a-z0-9-]+\.vercel\.app$/.test(url))
          throw new Error('Invalid Vercel deployment URL');

        if (!(await workerReady(id))) return false;

        readyUrl = `https://${url}`;

        return true;
      });

      return readyUrl;
    },
  };
}
