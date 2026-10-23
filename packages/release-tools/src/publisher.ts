import type { Release } from './index.js';

export interface RemoteRelease {
  id: number;
  draft: boolean;
}
export interface ReleaseManifest {
  schemaVersion: 1;
  app: string;
  version: string;
  tag: string;
  sha: string;
  image: string;
  digest: string;
}
export interface PublicationPort {
  readRelease(tag: string): Promise<RemoteRelease | null>;
  readTag(tag: string): Promise<string | null>;
  readManifest(remote: RemoteRelease): Promise<ReleaseManifest | null>;
  ensureImage(release: Release, image: string): Promise<string>;
  createTag(release: Release): Promise<void>;
  createDraft(release: Release): Promise<RemoteRelease>;
  uploadManifest(remote: RemoteRelease, manifest: ReleaseManifest): Promise<void>;
  publish(remote: RemoteRelease): Promise<void>;
}

/** Publish only after an immutable image and its source manifest exist. */
export async function publishRelease(
  release: Release,
  repository: string,
  port: PublicationPort,
): Promise<ReleaseManifest> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository');
  const image = `ghcr.io/${repository.split('/')[0]!.toLowerCase()}/flowboard-${release.app}`;
  const identity = {
    schemaVersion: 1 as const,
    app: release.app,
    version: release.version,
    tag: release.tag,
    sha: release.sha,
    image,
  };
  let remote = await port.readRelease(release.tag);
  const existingTag = await port.readTag(release.tag);
  if ((existingTag && existingTag !== release.sha) || (remote && !existingTag))
    throw new Error(`Conflicting tag ${release.tag}`);
  if (remote && !remote.draft) {
    const manifest = await port.readManifest(remote);
    if (
      !manifest ||
      Object.entries(identity).some(
        ([key, value]) => manifest[key as keyof ReleaseManifest] !== value,
      ) ||
      !/^sha256:[a-f0-9]{64}$/.test(manifest.digest)
    )
      throw new Error(`Conflicting or missing published manifest for ${release.tag}`);
    return manifest;
  }
  const digest = await port.ensureImage(release, image);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Registry returned an invalid digest');
  const manifest = { ...identity, digest };
  if (!existingTag) await port.createTag(release);
  remote ??= await port.createDraft(release);
  if ((await port.readTag(release.tag)) !== release.sha)
    throw new Error(`Conflicting tag ${release.tag}`);
  await port.uploadManifest(remote, manifest);
  await port.publish(remote);
  return manifest;
}
