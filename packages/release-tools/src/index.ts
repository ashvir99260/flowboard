import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { parseAllDocuments } from 'yaml';

export const applications = ['api', 'web', 'worker'] as const;
export type Application = (typeof applications)[number];
export interface Release {
  app: Application;
  version: string;
  tag: string;
  sha: string;
  previousTag?: string;
  mode: 'new' | 'resume';
}
interface Manifest {
  name: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}
interface Lock {
  importers: Record<string, Record<string, Record<string, { version: string }>>>;
  packages: Record<string, unknown>;
  snapshots: Record<
    string,
    { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }
  >;
}
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const productionFile = (path: string) =>
  path.startsWith('public/') ||
  !/(^|\/)(test|tests|__tests__|docs)(\/|$)|\.(test|spec)\.|\.md$|(^|\/)(eslint|prettier)|(^|\/)\.env(?:\.|$)|(^|\/)package\.json$/.test(
    path,
  );
const buildDependency = (name: string) => name === 'typescript' || name.startsWith('@types/');

/** Reads committed snapshots only: local working changes cannot accidentally be released. */
export function planReleases({
  cwd,
  publishedTags,
  sha = 'HEAD',
}: {
  cwd: string;
  publishedTags: string[];
  sha?: string;
}): Release[] {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trimEnd();
  const resolve = (ref: string) =>
    git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
  const ancestor = (a: string, b: string) => {
    const result = spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd });
    if (result.status !== 0 && result.status !== 1)
      throw new Error('Cannot inspect release ancestry');
    return result.status === 0;
  };
  const target = resolve(sha);
  const tags = git('tag', '--list').split('\n').filter(Boolean);
  const published = new Set(publishedTags);
  for (const tag of published)
    if (/^(api|web|worker)\/v/.test(tag) && !tags.includes(tag))
      throw new Error(`Published tag missing locally: ${tag}; fetch all tags`);
  const snapshots = new Map<string, Map<Application, string>>();
  const ownership = new Map<string, string[]>();
  const fingerprint = (commit: string, app: Application): string => {
    const cached = snapshots.get(commit)?.get(app);
    if (cached) return cached;
    const files = new Map(
      git('ls-tree', '-r', '-z', commit)
        .split('\0')
        .filter(Boolean)
        .map((entry) => {
          const [metadata, path] = entry.split('\t');
          return [path!, metadata!] as const;
        }),
    );
    const read = (path: string) => (files.has(path) ? git('show', `${commit}:${path}`) : '');
    const manifests = new Map<string, { path: string; manifest: Manifest }>();
    for (const path of files.keys())
      if (/^(apps|packages)\/[^/]+\/package\.json$/.test(path)) {
        const manifest = JSON.parse(read(path)) as Manifest;
        manifests.set(manifest.name, { path: path.replace('/package.json', ''), manifest });
      }
    const docs = parseAllDocuments(read('pnpm-lock.yaml')).map((document) => {
      if (document.errors.length)
        throw new Error(`Invalid lockfile: ${document.errors[0]?.message}`);
      return document.toJSON() as Lock;
    });
    const lock = docs.find((document) => document?.importers?.[`apps/${app}`]);
    if (!lock?.packages || !lock.snapshots)
      throw new Error(`Missing workspace lockfile for ${app} at ${commit}`);
    const inputs: Record<string, unknown> = {};
    const visited = new Set<string>();
    const external = new Set<string>();
    const visitExternal = (name: string, version: string) => {
      const key = `${name}@${version}`;
      if (external.has(key)) return;
      external.add(key);
      const snapshot = lock.snapshots[key];
      const metadata = lock.packages[key.replace(/\(.*/, '')];
      if (!snapshot || !metadata) throw new Error(`Unresolved lock dependency ${key}`);
      inputs[`dependency:${key}`] = { snapshot, metadata };
      for (const [child, resolved] of Object.entries({
        ...snapshot.dependencies,
        ...snapshot.optionalDependencies,
      }))
        visitExternal(child, resolved);
    };
    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      const workspace = manifests.get(name);
      if (!workspace) throw new Error(`Missing workspace ${name} at ${commit}`);
      const { path, manifest } = workspace;
      const selected = {
        ...manifest.dependencies,
        ...manifest.optionalDependencies,
        ...Object.fromEntries(
          Object.entries(manifest.devDependencies ?? {}).filter(([dependency]) =>
            buildDependency(dependency),
          ),
        ),
      };
      inputs[`manifest:${name}`] = {
        name,
        type: manifest.type,
        exports: manifest.exports,
        files: manifest.files,
        main: manifest.main,
        imports: manifest.imports,
        browser: manifest.browser,
        module: manifest.module,
        sideEffects: manifest.sideEffects,
        bin: manifest.bin,
        peerDependencies: manifest.peerDependencies,
        peerDependenciesMeta: manifest.peerDependenciesMeta,
        engines: manifest.engines,
        dependencies: selected,
        build: manifest.scripts?.build,
        start: manifest.scripts?.start,
      };
      for (const [file, blob] of files)
        if (file.startsWith(`${path}/`) && productionFile(file.slice(path.length + 1)))
          inputs[file] = blob;
      const importer = lock.importers[path];
      if (!importer) throw new Error(`Missing importer ${path}`);
      for (const [dependency, specifier] of Object.entries(selected)) {
        if (specifier.startsWith('workspace:')) visit(dependency);
        else {
          const version = (
            importer.dependencies?.[dependency] ??
            importer.optionalDependencies?.[dependency] ??
            importer.devDependencies?.[dependency]
          )?.version;
          if (!version) throw new Error(`Missing locked dependency ${dependency}`);
          visitExternal(dependency, version);
        }
      }
    };
    visit(`@flowboard/${app}`);
    if (manifests.has('@flowboard/config-typescript')) visit('@flowboard/config-typescript');
    const root = JSON.parse(read('package.json')) as Manifest;
    inputs.root = {
      packageManager: root.packageManager,
      engines: root.engines,
      turbo: root.devDependencies?.turbo,
    };
    for (const path of ['.npmrc', '.dockerignore', 'pnpm-workspace.yaml'])
      inputs[path] = read(path);
    const turbo = read('turbo.json')
      ? (JSON.parse(read('turbo.json')) as Record<string, unknown>)
      : {};
    inputs.turbo = {
      build: (turbo.tasks as Record<string, unknown> | undefined)?.build,
      globalDependencies: turbo.globalDependencies,
      globalEnv: turbo.globalEnv,
    };
    inputs.packageManager = docs.filter((document) => document !== lock);
    ownership.set(
      `${commit}:${app}`,
      [...visited].map((name) => manifests.get(name)!.path),
    );
    const hash = digest(inputs);
    if (!snapshots.has(commit)) snapshots.set(commit, new Map());
    snapshots.get(commit)!.set(app, hash);
    return hash;
  };
  return applications.flatMap((app): Release[] => {
    const versionOf = (tag: string) => {
      const match = new RegExp(`^${app}/v(\\d+)\\.(\\d+)\\.(\\d+)$`).exec(tag);
      if (
        !match ||
        match
          .slice(1)
          .some(
            (part) =>
              (part.length > 1 && part.startsWith('0')) || !Number.isSafeInteger(Number(part)),
          )
      )
        throw new Error(`Unsupported application tag: ${tag}`);
      return match.slice(1).map(Number) as [number, number, number];
    };
    const matching = tags.filter((tag) => tag.startsWith(`${app}/v`));
    matching.forEach(versionOf);
    const sorted = matching.sort((a, b) => {
      const left = versionOf(a),
        right = versionOf(b);
      return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
    });
    const previousTag = sorted.filter((tag) => published.has(tag)).at(-1);
    const previous = previousTag ? resolve(previousTag) : undefined;
    if (previous) {
      if (ancestor(target, previous)) return [];
      if (!ancestor(previous, target))
        throw new Error(`Diverged ${app} history from ${previousTag}`);
    }
    const pending = sorted.filter((tag) => !published.has(tag));
    if (pending.some((tag) => resolve(tag) !== target))
      throw new Error(
        `Unfinished ${app} tag; retry its source commit before releasing a newer commit`,
      );
    const targetFingerprint = fingerprint(target, app);
    if (previous && fingerprint(previous, app) === targetFingerprint) {
      if (pending.length) throw new Error(`Conflicting ${app} tag for an unchanged application`);
      return [];
    }
    let version = '0.1.0';
    if (previous && previousTag) {
      let bump = 0;
      for (const commit of git('rev-list', `${previous}..${target}`).split('\n').filter(Boolean)) {
        const parent = git('rev-list', '--parents', '-n', '1', commit).split(' ')[1];
        if (parent) {
          try {
            if (fingerprint(parent, app) === fingerprint(commit, app)) continue;
          } catch (error) {
            // A dependency can be added before its lockfile in the same PR. Final
            // snapshots still fail closed; classify such intermediate commits by
            // the known runtime ownership at the valid release endpoints.
            if (
              !(error instanceof Error) ||
              !/Missing (locked dependency|workspace|importer)|Unresolved lock dependency/.test(
                error.message,
              )
            )
              throw error;
            const paths = [
              ...(ownership.get(`${previous}:${app}`) ?? []),
              ...(ownership.get(`${target}:${app}`) ?? []),
            ];
            const changed = git(
              'diff-tree',
              '--no-commit-id',
              '--name-only',
              '-r',
              '-z',
              parent,
              commit,
            ).split('\0');
            if (
              !changed.some((file) =>
                paths.some(
                  (path) =>
                    file.startsWith(`${path}/`) &&
                    (file.endsWith('/package.json') || productionFile(file.slice(path.length + 1))),
                ),
              )
            )
              continue;
          }
        }
        const message = git('show', '-s', '--format=%B', commit);
        bump = Math.max(
          bump,
          /^(\w+)(\([^)]+\))?!:|^BREAKING[ -]CHANGE:/m.test(message)
            ? 2
            : /^feat(\([^)]+\))?:/.test(message)
              ? 1
              : 0,
        );
      }
      const [major, minor, patch] = versionOf(previousTag);
      version =
        bump === 2
          ? `${major + 1}.0.0`
          : bump === 1
            ? `${major}.${minor + 1}.0`
            : `${major}.${minor}.${patch + 1}`;
    }
    const tag = `${app}/v${version}`;
    versionOf(tag);
    if (pending.some((item) => item !== tag))
      throw new Error(`Conflicting ${app} tag; expected ${tag}`);
    return [
      {
        app,
        version,
        tag,
        sha: target,
        ...(previousTag ? { previousTag } : {}),
        mode: pending.length ? 'resume' : 'new',
      },
    ];
  });
}
