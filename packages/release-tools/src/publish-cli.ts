import { execFileSync } from 'node:child_process';

import { githubPort } from './github.js';
import { publishRelease } from './publisher.js';

import { planReleases } from './index.js';

const {
  GITHUB_REPOSITORY: repository,
  GITHUB_TOKEN: token,
  GITHUB_SHA: sha,
  GITHUB_REF: ref,
} = process.env;
if (!repository || !token || !sha || ref !== 'refs/heads/main')
  throw new Error('Publication requires GitHub main-branch context');
if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(sha))
  throw new Error('Invalid publication context');
const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== sha) throw new Error('Checkout must exactly match the workflow source SHA');
process.chdir(cwd);
const github = githubPort(repository, token);
const releases = planReleases({ cwd, sha, publishedTags: await github.publishedTags() });
process.stdout.write(`${JSON.stringify(releases, null, 2)}\n`);
for (const release of releases) {
  const manifest = await publishRelease(release, repository, github.port);
  process.stdout.write(`Published ${release.tag}: ${manifest.image}@${manifest.digest}\n`);
}
