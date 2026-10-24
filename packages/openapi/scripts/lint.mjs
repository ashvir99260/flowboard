import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const spectral = fileURLToPath(import.meta.resolve('@stoplight/spectral-cli'));
const ruleset = fileURLToPath(new URL('../.spectral.yaml', import.meta.url));

export async function lintDocument(path) {
  await execute(
    process.execPath,
    [spectral, 'lint', path, '--ruleset', ruleset, '--fail-severity=warn'],
    { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
  );
}
