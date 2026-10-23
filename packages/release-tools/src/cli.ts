import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { planReleases } from './index.js';

const { values } = parseArgs({
  options: { 'published-tags': { type: 'string' }, sha: { type: 'string' } },
});
if (!values['published-tags'])
  throw new Error('--published-tags must name a JSON array of published GitHub Release tags');
const tags: unknown = JSON.parse(readFileSync(values['published-tags'], 'utf8'));
if (!Array.isArray(tags) || !tags.every((tag: unknown) => typeof tag === 'string'))
  throw new Error('Published tags must be a string array');
const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.stdout.write(
  `${JSON.stringify(planReleases({ cwd, publishedTags: tags as string[], ...(values.sha ? { sha: values.sha } : {}) }))}\n`,
);
