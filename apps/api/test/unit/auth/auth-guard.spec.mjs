import { expect, test } from '@jest/globals';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from '../../../dist/auth/auth.guard.js';
import { ProtectedController } from '../../common/protected-controller.mjs';

test('default member guard rejects a valid identity with no workspace membership', async () => {
  const guard = new AuthGuard(new Reflector(), {
    async authenticate() {
      return { activeWorkspace: null };
    },
  });
  const context = {
    getHandler: () => ProtectedController.prototype.get,
    getClass: () => ProtectedController,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  };
  await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
});
