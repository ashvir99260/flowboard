import { fileURLToPath } from 'node:url';

import { defineConfig } from '@hey-api/openapi-ts';

export default await defineConfig({
  input: fileURLToPath(new URL('../openapi/openapi.json', import.meta.url)),
  output: {
    module: { extension: '.js' },
    path: fileURLToPath(new URL('./src/generated', import.meta.url)),
    postProcess: [],
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    { mutationOptions: true, name: '@tanstack/react-query', queryOptions: true },
  ],
});
