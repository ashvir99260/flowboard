import type { ReleaseManifest } from './publisher.js';

export interface DeploymentConfig {
  apiServiceId?: string;
  githubRepoId?: string;
  northflankProjectId?: string;
  northflankToken?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  vercelToken?: string;
  workerServiceId?: string;
}
export interface DeploymentProviders {
  vercel(manifest: ReleaseManifest): Promise<void>;
  northflank(manifest: ReleaseManifest, serviceId: string): Promise<void>;
}

export async function deployReleasedApps({
  sha,
  manifests,
  config,
  providers,
  assertCurrent,
  assertReachable,
}: {
  sha: string;
  manifests: ReleaseManifest[];
  config: DeploymentConfig;
  providers: DeploymentProviders;
  assertCurrent(): Promise<void>;
  assertReachable(source: string): Promise<void>;
}): Promise<void> {
  const seen = new Set<string>();
  const requireSetting = (key: keyof DeploymentConfig) => {
    if (!config[key]?.trim()) throw new Error(`Missing deployment setting: ${key}`);
  };
  for (const manifest of manifests) {
    if (
      !manifest ||
      manifest.schemaVersion !== 1 ||
      !['api', 'web', 'worker'].includes(manifest.app) ||
      !/^[a-f0-9]{40}$/.test(manifest.sha) ||
      !/^[a-f0-9]{40}$/.test(sha) ||
      manifest.tag !== `${manifest.app}/v${manifest.version}` ||
      !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
      !/^sha256:[a-f0-9]{64}$/.test(manifest.digest) ||
      !new RegExp(`^ghcr\\.io/[\\w.-]+/flowboard-${manifest.app}$`).test(manifest.image)
    )
      throw new Error('Invalid deployment manifest');
    await assertReachable(manifest.sha);
    if (seen.has(manifest.app)) throw new Error(`Duplicate deployment for ${manifest.app}`);
    seen.add(manifest.app);
    if (manifest.app === 'web') {
      for (const key of ['vercelToken', 'vercelProjectId', 'githubRepoId'] as const)
        requireSetting(key);
    } else {
      for (const key of ['northflankToken', 'northflankProjectId'] as const) requireSetting(key);
      requireSetting(manifest.app === 'api' ? 'apiServiceId' : 'workerServiceId');
    }
  }
  if (seen.has('api') && seen.has('worker') && config.apiServiceId === config.workerServiceId)
    throw new Error('API and worker require different service IDs');
  for (const manifest of [...manifests].sort(
    (a, b) => ['api', 'worker', 'web'].indexOf(a.app) - ['api', 'worker', 'web'].indexOf(b.app),
  )) {
    await assertCurrent();
    if (manifest.app === 'web') await providers.vercel(manifest);
    else
      await providers.northflank(
        manifest,
        (manifest.app === 'api' ? config.apiServiceId : config.workerServiceId)!,
      );
  }
}
