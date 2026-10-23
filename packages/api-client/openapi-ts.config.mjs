import { fileURLToPath } from 'node:url';

import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: fileURLToPath(new URL('../openapi/openapi.json', import.meta.url)),
  output: { module: { extension: '.js' }, path: 'src/generated', postProcess: [] },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    { mutationOptions: true, name: '@tanstack/react-query', queryOptions: true },
  ],
});
