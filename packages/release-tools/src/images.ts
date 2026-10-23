import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Release } from './index.js';

export async function ensureImage(release: Release, image: string): Promise<string> {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim();
  if (head !== release.sha || changes)
    throw new Error('Image publication requires a clean checkout at the release SHA');

  const run = (...args: string[]) =>
    execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
  const inspect = (ref: string) => {
    const result = spawnSync(
      'docker',
      ['buildx', 'imagetools', 'inspect', ref, '--format', '{{.Manifest.Digest}}'],
      { encoding: 'utf8' },
    );
    if (result.status === 0) return result.stdout.trim();

    if (/not found|manifest unknown|name unknown/i.test(result.stderr)) return null;

    throw new Error(`Cannot inspect registry image ${ref}: ${result.stderr}`);
  };
  const versionTag = `${image}:${release.version}`;
  const shaTag = `${image}:sha-${release.sha}`;
  const versionDigest = inspect(versionTag);
  const shaDigest = inspect(shaTag);
  if (versionDigest || shaDigest) {
    if (versionDigest && shaDigest && versionDigest !== shaDigest)
      throw new Error(`Conflicting image tags for ${release.tag}`);

    const digest = versionDigest ?? shaDigest!;
    run('pull', '--platform', 'linux/amd64', `${image}@${digest}`);
    const labels = JSON.parse(
      run('image', 'inspect', `${image}@${digest}`, '--format', '{{json .Config.Labels}}'),
    ) as Record<string, string>;
    if (
      labels['org.opencontainers.image.revision'] !== release.sha ||
      labels['org.opencontainers.image.version'] !== release.version ||
      labels['org.opencontainers.image.title'] !== release.app
    )
      throw new Error(`Conflicting existing image ${versionTag}`);

    for (const [tag, existing] of [
      [versionTag, versionDigest],
      [shaTag, shaDigest],
    ])
      if (!existing)
        run(
          'buildx',
          'imagetools',
          'create',
          '--prefer-index=false',
          '--tag',
          tag!,
          `${image}@${digest}`,
        );

    return digest;
  }

  const directory = mkdtempSync(join(tmpdir(), 'flowboard-image-'));
  try {
    const metadata = join(directory, 'metadata.json');
    execFileSync(
      'docker',
      [
        'buildx',
        'build',
        '--platform',
        'linux/amd64',
        '--file',
        `apps/${release.app}/Dockerfile`,
        '--tag',
        versionTag,
        '--tag',
        shaTag,
        '--label',
        `org.opencontainers.image.revision=${release.sha}`,
        '--label',
        `org.opencontainers.image.version=${release.version}`,
        '--label',
        `org.opencontainers.image.title=${release.app}`,
        '--metadata-file',
        metadata,
        '--push',
        '.',
      ],
      { stdio: 'inherit' },
    );
    const result = JSON.parse(readFileSync(metadata, 'utf8')) as Record<string, string>;
    const digest = result['containerimage.digest'];
    if (!digest) throw new Error('Build did not record an image digest');

    return digest;
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
