import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  logging: false,
  devIndicators: { position: 'bottom-right' },
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
};

export default nextConfig;
