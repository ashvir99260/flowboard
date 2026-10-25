import type { ReleaseManifest } from './publisher.js';

export interface DeploymentConfig {
  githubRepoId?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  vercelToken?: string;
}

export interface ReleasedDeployment {
  sha: string;
  tags: string[];
}

export interface DeploymentProviders {
  vercel(source: ReleasedDeployment): Promise<void>;
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
  }
  if (!manifests.length) return;

  for (const key of ['vercelToken', 'vercelProjectId', 'vercelTeamId', 'githubRepoId'] as const)
    if (!config[key]?.trim()) throw new Error(`Missing deployment setting: ${key}`);

  await assertCurrent();
  await providers.vercel({ sha, tags: manifests.map(({ tag }) => tag).sort() });
}
