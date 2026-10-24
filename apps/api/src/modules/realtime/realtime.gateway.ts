import { ListSubscriptionSchema, SocketEvents } from '@flowboard/contracts';
import { UseFilters, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import { AuthGuard } from '../auth/auth.guard.ts';
import { PermissionGuard } from '../permissions/permission.guard.ts';

import { RealtimeFilter } from './realtime.filter.ts';
import { RealtimeService } from './realtime.service.ts';

import type { OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({ transports: ['websocket'], maxHttpBufferSize: 16384, serveClient: false })
@UseFilters(RealtimeFilter)
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(private readonly realtime: RealtimeService) {}
  afterInit(server: Server) {
    this.realtime.attach(server);
  }
  handleDisconnect(socket: Socket) {
    this.realtime.disconnected(socket);
  }
  @UseGuards(AuthGuard, PermissionGuard)
  @SubscribeMessage(SocketEvents.subscribe)
  subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.realtime.subscribe(socket, ListSubscriptionSchema.parse(body).listId);
  }
  @UseGuards(AuthGuard)
  @SubscribeMessage(SocketEvents.unsubscribe)
  unsubscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.realtime.unsubscribe(socket, ListSubscriptionSchema.parse(body).listId);
  }
}
