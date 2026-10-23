import { deployReleasedApps, type DeploymentConfig } from './deploy.js';
import { createDeploymentProviders } from './deployment-providers.js';
import { githubPort } from './github.js';

const {
  GITHUB_REPOSITORY: repository,
  GITHUB_TOKEN: token,
  GITHUB_SHA: sha,
  GITHUB_REF: ref,
} = process.env;
if (process.env.CD_ENABLED !== 'true' || ref !== 'refs/heads/main')
  throw new Error('Preview deployment is not enabled for this context');
if (
  !repository ||
  !token ||
  !sha ||
  !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
  !/^[a-f0-9]{40}$/.test(sha)
)
  throw new Error('Invalid deployment source context');
const values = {
  vercelToken: process.env.VERCEL_TOKEN,
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
  vercelTeamId: process.env.VERCEL_TEAM_ID,
  githubRepoId: process.env.GITHUB_REPOSITORY_ID,
  northflankToken: process.env.NORTHFLANK_API_TOKEN,
  northflankProjectId: process.env.NORTHFLANK_PROJECT_ID,
  apiServiceId: process.env.NORTHFLANK_API_SERVICE_ID,
  workerServiceId: process.env.NORTHFLANK_WORKER_SERVICE_ID,
};
const config = Object.fromEntries(
  Object.entries(values).filter(([, value]) => value !== undefined),
) as DeploymentConfig;
const github = githubPort(repository, token);
const assertCurrent = () => github.assertCurrentMain(sha);
const manifests = await github.releasedManifests(sha);
const providers = createDeploymentProviders(config, { assertCurrent });
await deployReleasedApps({
  sha,
  manifests,
  config,
  providers: {
    ...providers,
    async vercel(manifest) {
      const url = await providers.vercel(manifest);
      process.stdout.write(`Web preview ready: ${url} (${manifest.tag})\n`);
    },
  },
  assertCurrent,
  assertReachable: (source) => github.assertReachable(source, sha),
});
process.stdout.write(
  manifests.length
    ? `Deployed released applications to preview: ${manifests.map((manifest) => manifest.tag).join(', ')}\n`
    : 'No published applications; deployment skipped.\n',
);
