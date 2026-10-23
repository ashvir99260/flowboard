import { expect, jest, test } from '@jest/globals';

import { createApplication } from '../../../dist/application.js';

test('application closes each injected runtime once after module composition', async () => {
  const closeProbe = jest.fn(async () => {});
  const closeAuth = jest.fn(async () => {});
  const closeDatabase = jest.fn(async () => {});
  const { app } = await createApplication(
    { async check() {}, close: closeProbe },
    {
      auth: { settings: { allowedOrigins: [] }, close: closeAuth },
      database: { close: closeDatabase },
    },
  );
  try {
    await app.init();
    expect(closeProbe).not.toHaveBeenCalled();
    expect(closeAuth).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
  expect(closeProbe).toHaveBeenCalledTimes(1);
  expect(closeAuth).toHaveBeenCalledTimes(1);
  expect(closeDatabase).toHaveBeenCalledTimes(1);
});
