import { registerHooks } from 'node:module';

// Fault injection is limited to the isolated checker subprocess.
const specModule = import.meta.resolve('@flowboard/api/spec');
registerHooks({
  load(url, context, nextLoad) {
    if (url !== specModule) return nextLoad(url, context);

    return {
      format: 'module',
      shortCircuit: true,
      source: `import { readFile } from 'node:fs/promises';
        export async function exportOpenApi() {
          const document = JSON.parse(await readFile(process.env.FLOWBOARD_INVALID_SPEC, 'utf8'));
          delete document.paths['/health/live'].get.operationId;
          return document;
        }`,
    };
  },
});
