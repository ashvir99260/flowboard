import { SetMetadata } from '@nestjs/common';

export const PublicRouteKey = 'flowboard:public-route';
export const PublicRoute = (reason: 'health' | 'auth') => SetMetadata(PublicRouteKey, reason);
