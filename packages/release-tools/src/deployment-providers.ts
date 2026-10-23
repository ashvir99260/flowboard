import { setTimeout as delay } from 'node:timers/promises';

import type { DeploymentConfig } from './deploy.js';
import type { ReleaseManifest } from './publisher.js';

interface NorthflankService {
  data: {
    deployment: {
      instances: number;
      external?: { imagePath: string; credentials?: string };
      imageUrl?: string;
    };
    status: { deployment: { status: string; lastTransitionTime?: string | number } };
  };
}
interface ProviderOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  assertCurrent: () => Promise<void>;
}

export function createDeploymentProviders(config: DeploymentConfig, options: ProviderOptions) {
  const request = async <T>(
    url: string,
    token: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> => {
    const response = await (options.fetch ?? fetch)(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Deployment provider ${method} failed (${response.status})`);
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
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
  return {
    async vercel(manifest: ReleaseManifest) {
      const projectPath = `/v9/projects/${encodeURIComponent(config.vercelProjectId!)}`;
      type Project = {
        name: string;
        targets?: { production?: { id: string } };
        lastAliasRequest?: { toDeploymentId?: string; jobStatus?: string; type?: string };
        rollingRelease?: { enabled?: boolean; stages?: unknown[] };
      };
      type Deployment = {
        uid?: string;
        id?: string;
        readyState?: string;
        state?: string;
        target?: string;
        meta?: Record<string, string>;
      };
      const readProject = () => request<Project>(vercelUrl(projectPath), config.vercelToken!);
      const project = await readProject();
      if (!project.name) throw new Error('Vercel project was not found');
      if (project.rollingRelease?.enabled || project.rollingRelease?.stages?.length)
        throw new Error('Disable Vercel rolling releases for this deployment workflow');
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
            sha: manifest.sha,
            limit: '100',
            ...(until ? { until } : {}),
          }),
          config.vercelToken!,
        );
        if (!Array.isArray(page.deployments)) throw new Error('Invalid Vercel deployment listing');
        existing = page.deployments.find(
          (deployment) =>
            deployment.target === 'production' &&
            deployment.meta?.flowboardSha === manifest.sha &&
            deployment.meta?.flowboardTag === manifest.tag &&
            !['ERROR', 'CANCELED', 'BLOCKED'].includes(
              deployment.state ?? deployment.readyState ?? '',
            ),
        );
        const next = page.pagination?.next;
        until = next ? String(next) : '';
        if (until && cursors.has(until)) throw new Error('Repeated Vercel pagination cursor');
        if (until) cursors.add(until);
      } while (!existing && until);
      if (!existing) {
        await options.assertCurrent();
        existing = await request<Deployment>(
          vercelUrl('/v13/deployments'),
          config.vercelToken!,
          'POST',
          {
            name: project.name,
            project: config.vercelProjectId,
            target: 'production',
            autoAssignCustomDomains: false,
            gitSource: {
              type: 'github',
              repoId: config.githubRepoId,
              ref: manifest.sha,
              sha: manifest.sha,
            },
            meta: { flowboardSha: manifest.sha, flowboardTag: manifest.tag },
          },
        );
      }
      const id = existing.id ?? existing.uid;
      if (!id) throw new Error('Vercel did not return a deployment ID');
      await wait(async () => {
        await options.assertCurrent();
        const deployment = await request<Deployment>(
          vercelUrl(`/v13/deployments/${encodeURIComponent(id)}`),
          config.vercelToken!,
        );
        if (['ERROR', 'CANCELED', 'BLOCKED'].includes(deployment.readyState ?? ''))
          throw new Error('Vercel deployment failed');
        return deployment.readyState === 'READY';
      });
      const promoted = (value: Project) =>
        value.lastAliasRequest?.toDeploymentId === id &&
        ((value.lastAliasRequest.jobStatus === 'succeeded' &&
          (!value.targets?.production || value.targets.production.id === id)) ||
          (value.lastAliasRequest.jobStatus === 'skipped' &&
            value.lastAliasRequest.type === 'promote' &&
            value.targets?.production?.id === id));
      if (promoted(await readProject())) return;
      await options.assertCurrent();
      await request(
        vercelUrl(
          `/v10/projects/${encodeURIComponent(config.vercelProjectId!)}/promote/${encodeURIComponent(id)}`,
        ),
        config.vercelToken!,
        'POST',
        {},
      );
      await wait(async () => {
        await options.assertCurrent();
        const value = await readProject();
        if (
          value.lastAliasRequest?.toDeploymentId === id &&
          value.lastAliasRequest.jobStatus === 'failed'
        )
          throw new Error('Vercel promotion failed');
        return promoted(value);
      });
    },
    async northflank(manifest: ReleaseManifest, serviceId: string) {
      const url = `https://api.northflank.com/v1/projects/${encodeURIComponent(config.northflankProjectId!)}/services/${encodeURIComponent(serviceId)}`;
      const read = () => request<NorthflankService>(url, config.northflankToken!);
      const target = `${manifest.image}@${manifest.digest}`;
      const initial = await read();
      const deployment = initial.data.deployment;
      if (
        !deployment.external ||
        !Number.isInteger(deployment.instances) ||
        deployment.instances < 1
      )
        throw new Error('Northflank target must be a running external-image service');
      if (deployment.external.imagePath !== target) {
        await options.assertCurrent();
        const patch = `https://api.northflank.com/v1/projects/${encodeURIComponent(config.northflankProjectId!)}/services/deployment/${encodeURIComponent(serviceId)}`;
        await request(patch, config.northflankToken!, 'PATCH', {
          deployment: {
            external: {
              imagePath: target,
              ...(deployment.external.credentials
                ? { credentials: deployment.external.credentials }
                : {}),
            },
          },
        });
      }
      await wait(async () => {
        await options.assertCurrent();
        const current = await read();
        if (current.data.status.deployment.status === 'FAILED')
          throw new Error(`Northflank ${manifest.app} deployment failed`);
        return (
          current.data.deployment.external?.imagePath === target &&
          current.data.status.deployment.status === 'COMPLETED' &&
          !!current.data.deployment.imageUrl?.includes(manifest.digest)
        );
      });
    },
  };
}
