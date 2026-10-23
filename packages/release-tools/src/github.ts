import { ensureImage } from './images.js';

import type { Release } from './index.js';
import type { PublicationPort, ReleaseManifest, RemoteRelease } from './publisher.js';

interface ApiRelease extends RemoteRelease {
  tag_name: string;
  target_commitish: string;
  upload_url: string;
  assets: { id: number; name: string }[];
}

export function githubPort(repository: string, token: string, baseUrl = 'https://api.github.com') {
  const api = async <T>(path: string, method = 'GET', body?: unknown): Promise<T | null> => {
    const response = await fetch(`${baseUrl}/repos/${repository}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed (${response.status})`);
    return response.status === 204 ? null : ((await response.json()) as T);
  };
  const port: PublicationPort = {
    async readRelease(tag) {
      const published = await api<ApiRelease>(`/releases/tags/${encodeURIComponent(tag)}`);
      if (published) return published;
      // The tag endpoint returns published releases only. Authenticated listing
      // is required to resume a draft after an interrupted upload/publication.
      for (let page = 1; ; page++) {
        const releases = await api<ApiRelease[]>(`/releases?per_page=100&page=${page}`);
        if (!releases) throw new Error('Cannot inspect draft releases');
        const draft = releases.find((release) => release.tag_name === tag);
        if (draft) return draft;
        if (releases.length < 100) return null;
      }
    },
    async readTag(tag) {
      let ref = await api<{ object: { sha: string; type: string } }>(
        `/git/ref/tags/${encodeURIComponent(tag)}`,
      );
      for (let depth = 0; ref?.object.type === 'tag' && depth < 8; depth++)
        ref = await api(`/git/tags/${ref.object.sha}`);
      if (ref && ref.object.type !== 'commit') throw new Error(`Invalid release tag ${tag}`);
      return ref?.object.sha ?? null;
    },
    async readManifest(remote) {
      const value = await api<ApiRelease>(`/releases/${remote.id}`);
      const asset = value?.assets.find((entry) => entry.name === 'release.json');
      if (!asset) return null;
      const response = await fetch(`${baseUrl}/repos/${repository}/releases/assets/${asset.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' },
      });
      if (!response.ok) throw new Error(`Cannot read release manifest (${response.status})`);
      return (await response.json()) as ReleaseManifest;
    },
    ensureImage,
    async createTag(release) {
      await api('/git/refs', 'POST', { ref: `refs/tags/${release.tag}`, sha: release.sha });
    },
    async createDraft(release: Release) {
      const remote = await api<ApiRelease>('/releases', 'POST', {
        tag_name: release.tag,
        target_commitish: release.sha,
        name: release.tag,
        draft: true,
        body: `Independent ${release.app} release from ${release.sha}.\n\nSee release.json for the immutable container digest and source manifest.`,
      });
      if (!remote) throw new Error('GitHub did not return a draft release');
      return remote;
    },
    async uploadManifest(remote, manifest) {
      const value = await api<ApiRelease>(`/releases/${remote.id}`);
      if (!value?.draft) throw new Error('Refusing to modify a published release');
      const existing = value.assets.find((asset) => asset.name === 'release.json');
      if (existing) await api(`/releases/assets/${existing.id}`, 'DELETE');
      const url = new URL(value.upload_url.replace(/\{.*$/, ''));
      url.searchParams.set('name', 'release.json');
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: `${JSON.stringify(manifest, null, 2)}\n`,
      });
      if (!response.ok) throw new Error(`Cannot upload release manifest (${response.status})`);
    },
    async publish(remote) {
      await api(`/releases/${remote.id}`, 'PATCH', { draft: false });
    },
  };
  return {
    port,
    async assertCurrentMain(sha: string) {
      const ref = await api<{ object: { sha: string; type: string } }>('/git/ref/heads/main');
      if (ref?.object.type !== 'commit' || ref.object.sha !== sha)
        throw new Error('Stale deployment: main no longer matches this workflow');
    },
    async assertReachable(source: string, head: string) {
      const comparison = await api<{ status: string }>(`/compare/${source}...${head}`);
      if (!comparison || !['ahead', 'identical'].includes(comparison.status))
        throw new Error('Invalid deployment source: release is not an ancestor of main');
    },
    async releasedManifests(head: string) {
      const latest = new Map<string, { release: ApiRelease; version: number[] }>();
      for (let page = 1; ; page++) {
        const releases = await api<ApiRelease[]>(`/releases?per_page=100&page=${page}`);
        if (!releases) throw new Error('Cannot list deployment releases');
        for (const release of releases) {
          if (release.draft) continue;
          const match = /^(api|web|worker)\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(
            release.tag_name,
          );
          if (!match) continue;
          const version = match.slice(2).map(Number);
          if (!version.every(Number.isSafeInteger)) throw new Error('Invalid release version');
          const previous = latest.get(match[1]!);
          const difference = previous
            ? (version
                .map((value, index) => value - previous.version[index]!)
                .find((value) => value !== 0) ?? 0)
            : 1;
          if (difference > 0) latest.set(match[1]!, { release, version });
        }
        if (releases.length < 100) break;
      }
      const manifests: ReleaseManifest[] = [];
      for (const { release } of latest.values()) {
        const manifest = await port.readManifest(release);
        if (
          !manifest ||
          !/^[a-f0-9]{40}$/.test(manifest.sha) ||
          manifest.tag !== release.tag_name ||
          manifest.tag !== `${manifest.app}/v${manifest.version}` ||
          manifest.schemaVersion !== 1 ||
          !['api', 'web', 'worker'].includes(manifest.app) ||
          manifest.image !==
            `ghcr.io/${repository.split('/')[0]!.toLowerCase()}/flowboard-${manifest.app}` ||
          !/^sha256:[a-f0-9]{64}$/.test(manifest.digest) ||
          (await port.readTag(release.tag_name)) !== manifest.sha
        )
          throw new Error(`Invalid deployment manifest for ${release.tag_name}`);
        const comparison = await api<{ status: string }>(`/compare/${manifest.sha}...${head}`);
        if (!comparison || !['ahead', 'identical'].includes(comparison.status))
          throw new Error('Invalid deployment source: release is not an ancestor of main');
        manifests.push(manifest);
      }
      return manifests;
    },
    async publishedTags() {
      const tags: string[] = [];
      for (let page = 1; ; page++) {
        const releases = await api<ApiRelease[]>(`/releases?per_page=100&page=${page}`);
        if (!releases) throw new Error('Cannot list repository releases');
        tags.push(
          ...releases.filter((release) => !release.draft).map((release) => release.tag_name),
        );
        if (releases.length < 100) return tags;
      }
    },
  };
}
