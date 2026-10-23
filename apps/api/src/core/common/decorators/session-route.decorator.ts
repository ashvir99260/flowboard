import { SetMetadata } from '@nestjs/common';

export const SessionRouteKey = 'flowboard:session-route';

export const SessionRoute = (cookie = false) => SetMetadata(SessionRouteKey, { cookie });
