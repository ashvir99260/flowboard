import { EventChannelName, OutboxRecordSchema, SocketEvents } from '@flowboard/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

import { ApiException } from '../../core/common/errors/api-exception.js';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';
import { RedisConnectionOptions } from '../../core/config/redis.config.js';
import { AuthService } from '../auth/auth.service.js';
import { PermissionService } from '../permissions/permission.service.js';

import { observedAdapterClient } from './adapter-client.js';

import type { OutboxRecord, RealtimeInvalidation } from '@flowboard/contracts';
import type { Logger } from '@flowboard/logger';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

export const RealtimeConfigKey = Symbol('RealtimeConfig');

const peerEvent = 'flowboard.internal.event';
const room = (workspaceId: string, listId: string) => `workspace:${workspaceId}:list:${listId}`;

@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private server?: Server;
  private readonly clients = new Map<
    Socket,
    { expiry: ReturnType<typeof setTimeout>; lists: Set<string>; workspaceId: string }
  >();
  private readonly seen = new Set<string>();
  private readonly redis: Redis[];
  private ready = false;
  private closing = false;
  private timer?: ReturnType<typeof setInterval>;
  private checking = false;
  private recovering = false;

  constructor(
    @Inject(RealtimeConfigKey) private readonly config: { redisUrl: string },
    private readonly auth: AuthService,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {
    this.redis = Array.from(
      { length: 3 },
      () => new Redis(config.redisUrl, { ...RedisConnectionOptions, lazyConnect: true }),
    );
    for (const connection of this.redis) {
      connection.on('error', () =>
        this.logger.warn('realtime.redis.unavailable', { code: 'REDIS_UNAVAILABLE' }),
      );
      connection.on('close', () => {
        this.ready = false;
        for (const socket of this.clients.keys()) socket.disconnect(true);
      });
    }
  }
  attach(server: Server) {
    this.server = server;
    const [publisher, subscriber, events] = this.redis as [Redis, Redis, Redis];

    server.on(peerEvent, (event: unknown) => {
      void this.acceptPeerEvent(event);
    });
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(({ identity, accessExpiresAt }) => {
          if (socket.conn.readyState !== 'open' || this.closing) return;

          const expiry = setTimeout(
            () => socket.disconnect(true),
            Math.max(0, accessExpiresAt.getTime() - Date.now()),
          );
          expiry.unref();
          this.clients.set(socket, {
            expiry,
            lists: new Set(),
            workspaceId: identity.activeWorkspace!.id,
          });
          socket.conn.once('close', () => this.disconnected(socket));
          next();
        })
        .catch(() => next(new Error('Authentication required')));
    });
    events.on('message', (_channel, value) => {
      try {
        void this.acceptWorkerEvent(JSON.parse(value));
      } catch {
        /* Invalid trusted-channel input is dropped. */
      }
    });
    const subscribe = async () => {
      if (this.redis.some((connection) => connection.status !== 'ready')) return;

      await events.subscribe(EventChannelName);
      await subscriber.ping();
      this.ready = !this.closing && this.redis.every((connection) => connection.status === 'ready');
      if (this.ready) this.recovering = false;
    };
    for (const connection of this.redis)
      connection.on('ready', () => {
        if (events.status === 'ready' && !this.closing)
          void subscribe().catch(() => {
            this.ready = false;
          });
      });
    server.adapter(
      createAdapter(
        observedAdapterClient(publisher, () => this.connectionFailed()),
        observedAdapterClient(subscriber, () => this.connectionFailed()),
        { key: 'flowboard:socket.io' },
      ),
    );
    void Promise.all(
      this.redis.map(async (connection) => {
        if (connection.status === 'wait') await connection.connect();
      }),
    )
      .then(subscribe)
      .catch(() => {
        this.ready = false;
      });
  }
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.recheck();
    }, 2000);
    this.timer.unref();
  }
  private connectionFailed() {
    if (this.closing || this.recovering) return;

    this.recovering = true;
    this.ready = false;
    for (const socket of this.clients.keys()) socket.disconnect(true);
    for (const connection of this.redis) connection.disconnect(true);
  }
  isReady() {
    return this.ready && !this.closing;
  }
  private async authenticate(socket: Socket) {
    if (!this.ready || this.closing) throw new Error('Unavailable');

    this.auth.assertOrigin(socket.handshake.headers.origin);
    if (
      'token' in socket.handshake.query ||
      Object.keys(socket.handshake.auth).some((key) => key !== 'token')
    )
      throw new Error('Invalid credentials');

    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid credentials');

    const verified = await this.auth.authenticateAccess(`Bearer ${token}`);
    if (!verified.identity.activeWorkspace) throw new Error('Membership required');

    return verified;
  }
  disconnected(socket: Socket) {
    const state = this.clients.get(socket);
    if (state) clearTimeout(state.expiry);

    this.clients.delete(socket);
  }
  async subscribe(socket: Socket, listId: string) {
    const state = this.clients.get(socket);
    if (!state || (state.lists.size >= 20 && !state.lists.has(listId)))
      throw new ApiException(429, 'RATE_LIMITED', 'Subscription limit reached');

    // PermissionGuard already verified this packet; re-read at the join boundary.
    const { identity } = await this.authenticate(socket);
    await this.permissions.authorizeList(identity, listId);
    if (!socket.connected) return { ok: false };

    if (state.lists.size >= 20 && !state.lists.has(listId))
      throw new ApiException(429, 'RATE_LIMITED', 'Subscription limit reached');

    state.lists.add(listId);
    await socket.join(room(state.workspaceId, listId));

    return { ok: true };
  }
  async unsubscribe(socket: Socket, listId: string) {
    const state = this.clients.get(socket);
    if (state) {
      state.lists.delete(listId);
      await socket.leave(room(state.workspaceId, listId));
    }

    return { ok: true };
  }
  private claim(input: unknown) {
    const parsed = OutboxRecordSchema.safeParse(input);
    if (!parsed.success || this.seen.has(parsed.data.id)) return;

    this.seen.add(parsed.data.id);
    if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value!);

    return parsed.data;
  }
  async acceptWorkerEvent(input: unknown) {
    const event = this.claim(input);
    if (!event || this.closing) return;

    this.server?.serverSideEmit(peerEvent, event);
    await this.dispatch(event);
  }
  private async acceptPeerEvent(input: unknown) {
    const event = this.claim(input);
    if (event && !this.closing) await this.dispatch(event);
  }
  private emit(socket: Socket, payload: RealtimeInvalidation) {
    if (socket.connected && this.ready) socket.emit(SocketEvents.invalidate, payload);
  }
  private async check(socket: Socket) {
    const state = this.clients.get(socket);
    if (!state) return;

    try {
      const { identity } = await this.authenticate(socket);
      if (identity.activeWorkspace?.id !== state.workspaceId) throw new Error('Session changed');

      let revoked = false;
      for (const listId of state.lists) {
        try {
          await this.permissions.authorizeList(identity, listId);
        } catch {
          state.lists.delete(listId);
          await socket.leave(room(state.workspaceId, listId));
          revoked = true;
        }
      }
      if (revoked) this.emit(socket, { kind: 'resync' });

      return { state, identity };
    } catch {
      socket.disconnect(true);

      return;
    }
  }
  private async recheck() {
    if (this.checking || this.closing) return;

    this.checking = true;
    try {
      await Promise.all([...this.clients.keys()].map((socket) => this.check(socket)));
    } finally {
      this.checking = false;
    }
  }
  private async dispatch(event: OutboxRecord) {
    await Promise.all(
      [...this.clients.keys()].map(async (socket) => {
        const current = await this.check(socket);
        if (!current || current.state.workspaceId !== event.workspaceId) return;

        if (event.eventType === 'workspace.config.updated' || event.eventType === 'node.updated') {
          this.emit(socket, { kind: 'workspace', eventId: event.id });

          return;
        }

        const lists = new Set([
          event.payload.currentListId,
          ...('previousListId' in event.payload ? [event.payload.previousListId] : []),
        ]);
        for (const listId of lists) {
          if (!current.state.lists.has(listId)) continue;

          // Each final emission gets a current read; adapter messages never contain recipient decisions.
          try {
            await this.permissions.authorizeList(current.identity, listId);
          } catch {
            await this.check(socket);
            continue;
          }
          this.emit(socket, { kind: 'list', listId, eventId: event.id });
        }
      }),
    );
  }
  async onApplicationShutdown() {
    this.closing = true;
    clearInterval(this.timer);
    for (const socket of this.clients.keys()) {
      this.disconnected(socket);
      socket.disconnect(true);
    }
    for (const connection of this.redis) connection.disconnect();
  }
}
