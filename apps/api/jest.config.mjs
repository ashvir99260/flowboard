import base from '@flowboard/config-jest';

export default {
  ...base,
  testMatch: ['<rootDir>/test/**/*.spec.mjs'],
  testTimeout: 120_000,
  transform: {},
};
