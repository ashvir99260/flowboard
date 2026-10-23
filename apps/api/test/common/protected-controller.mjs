import { Controller, Get, Req } from '@nestjs/common';

export class ProtectedController {
  get(req) {
    return { userId: req.identity.user.id, role: req.identity.activeWorkspace?.role };
  }
}

Controller('protected')(ProtectedController);
Get()(
  ProtectedController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'get'),
);
Req()(ProtectedController.prototype, 'get', 0);
