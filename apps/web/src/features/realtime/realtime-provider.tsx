'use client';

import { SocketEvents } from '@flowboard/contracts';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { useNotifications } from '../notifications/notification-provider';

import { createInvalidationTracker, createRealtimeBus } from './realtime-events';

import type { ClientRuntime } from '../../providers/app-providers';
import type { RealtimeInvalidation, SessionEnvelope } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const RealtimeContext = createContext<ReturnType<typeof createRealtimeBus> | null>(null);

export function RealtimeProvider({
  children,
  runtime,
  session,
  url,
}: {
  children: ReactNode;
  runtime: ClientRuntime | null;
  session: SessionEnvelope | null;
  url: string | null;
}) {
  const [bus] = useState(createRealtimeBus);
  const notifications = useNotifications();
  useEffect(() => {
    if (!runtime || !session?.data.activeWorkspace || !url) return;

    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const accept = createInvalidationTracker();
    const socket = io(url, {
      autoConnect: false,
      transports: ['websocket'],
      query: { notifications: 'v1' },
      auth: (done) => done({ token: runtime.getSession()?.data.accessToken }),
    });
    let subscribed = new Set<string>();
    const subscriptions = () => {
      if (!socket.connected) return;

      const lists = new Set(bus.lists());
      for (const listId of subscribed)
        if (!lists.has(listId)) socket.emit(SocketEvents.unsubscribe, { listId });
      for (const listId of lists)
        if (!subscribed.has(listId)) socket.emit(SocketEvents.subscribe, { listId });
      subscribed = lists;
    };
    const reconnect = () => {
      clearTimeout(retry);
      retry = setTimeout(() => {
        if (active) socket.connect();
      }, 2000);
    };
    const unlisten = bus.onSubscriptionsChanged(subscriptions);
    socket.on('connect', () => {
      subscribed = new Set();
      subscriptions();
      bus.dispatch({ kind: 'resync' });
    });
    socket.on(SocketEvents.invalidate, (input: unknown) => {
      const event = accept(input);
      if (active && event && runtime.getSession()?.data.accessToken === session.data.accessToken) {
        if (event.kind === 'workspace') {
          subscribed = new Set();
          subscriptions();
        }

        if (
          event.kind !== 'resync' &&
          event.self === false &&
          (event.kind !== 'list' || bus.lists().includes(event.listId))
        )
          notifications.remote(
            event.eventId,
            event.kind === 'list'
              ? 'Tasks in this list were updated.'
              : 'Workspace settings were updated.',
          );

        bus.dispatch(event);
      }
    });
    socket.on('exception', () => {
      if (active) bus.dispatch({ kind: 'resync' });
    });
    socket.on('connect_error', reconnect);
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') reconnect();
    });
    socket.connect();
    const refresh = setTimeout(
      () => {
        void runtime.refresh().catch(() => undefined);
      },
      Math.max(1000, Date.parse(session.data.expiresAt) - Date.now() - 30000),
    );

    return () => {
      active = false;
      clearTimeout(retry);
      clearTimeout(refresh);
      unlisten();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [bus, notifications, runtime, session, url]);

  return <RealtimeContext.Provider value={bus}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(
  listId: string | undefined,
  handler: (event: RealtimeInvalidation) => void,
) {
  const bus = useContext(RealtimeContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  }, [handler]);
  useEffect(() => bus?.listen(listId, (event) => latest.current(event)), [bus, listId]);
}
