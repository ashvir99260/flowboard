import { createApplication } from './application.js';

/** Metadata-only bootstrap. No runtime dependency configuration is read here. */
export async function exportOpenApi() {
  const { app, document } = await createApplication({
    async check() {
      throw new Error('Spec-only dependency probe cannot serve requests');
    },
    async close() {},
  });
  await app.close();
  return document;
}
