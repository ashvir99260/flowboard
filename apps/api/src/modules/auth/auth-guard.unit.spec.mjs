import { expect, jest, test } from '@jest/globals';
import { Reflector } from '@nestjs/core';

import { AuthGuard } from '../../../dist/modules/auth/auth.guard.js';
import { ProtectedController } from '../../../test/common/protected-controller.mjs';

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

test.each(['before', 'during'])(
  'socket authentication stops when disconnected %s its read',
  async (phase) => {
    const socket = {
      connected: phase !== 'before',
      handshake: { auth: { token: 'test' }, headers: {} },
    };
    const authenticate = jest.fn(async () => {
      socket.connected = false;

      return { activeWorkspace: { id: 'workspace' } };
    });
    const guard = new AuthGuard(new Reflector(), { assertOrigin() {}, authenticate });
    const context = { getType: () => 'ws', switchToWs: () => ({ getClient: () => socket }) };
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(authenticate).toHaveBeenCalledTimes(phase === 'before' ? 0 : 1);
    expect(socket.identity).toBeUndefined();
  },
);
