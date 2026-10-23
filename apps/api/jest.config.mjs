import base from '@flowboard/config-jest';

export default {
  ...base,
  testMatch: ['<rootDir>/test/unit/**/*.spec.mjs', '<rootDir>/test/integration/**/*.spec.mjs'],
  testTimeout: 120_000,
  transform: {},
};
