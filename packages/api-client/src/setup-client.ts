import { createClient } from './generated/client/index.js';
import {
  logIn,
  logOut,
  refreshSession,
  signUp,
  switchWorkspace as switchWorkspaceRequest,
} from './generated/sdk.gen.js';
import { ClientSessionError, createSessionState } from './session-state.js';
import { createSessionSync } from './session-sync.js';

import type { Client, RequestOptions } from './generated/client/index.js';
import type { LogInData, SignUpData } from './generated/types.gen.js';
import type { SessionChangeReason } from './session-state.js';
import type { SessionSync } from './session-sync.js';
import type { SessionEnvelope } from '@flowboard/contracts';

export interface SetupClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  initialSession?: SessionEnvelope;
  onSessionChange?: (session: SessionEnvelope | null, reason: SessionChangeReason) => void;
  origin: string;
  sync?: SessionSync;
}

function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

export function setupClient(options: SetupClientOptions) {
  const sync = options.sync ?? createSessionSync();
  let pending: Promise<SessionEnvelope> | undefined;
  const state = createSessionState(sync, options.initialSession, (session, reason) => {
    if (reason !== 'refresh') pending = undefined;

    options.onSessionChange?.(session, reason);
  });
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const auth = (scheme: { scheme?: string }) =>
    scheme.scheme === 'bearer' ? state.inspect().session?.data.accessToken : undefined;
  const configuration = {
    auth,
    baseUrl: options.baseUrl,
    credentials: 'include' as const,
    fetch: fetchRequest,
  };
  const raw = createClient(configuration);
  const transport = createClient(configuration);
  const stamp = Symbol('session-authority');
  const verbs = new Set([
    'request',
    'get',
    'post',
    'patch',
    'put',
    'delete',
    'head',
    'options',
    'connect',
    'trace',
  ]);
  const client = new Proxy<Client>(transport, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver);
      if (!verbs.has(String(property)) || typeof method !== 'function') return method;

      return async (requestOptions: RequestOptions) => {
        if (!requestOptions.security?.some((scheme) => scheme.scheme === 'bearer'))
          return Reflect.apply(method, target, [requestOptions]);

        state.assert();
        requestOptions.signal?.throwIfAborted();
        const { epoch, tokenRevision } = state.inspect();
        try {
          const result = await Reflect.apply(method, target, [
            { ...requestOptions, [stamp]: { epoch, tokenRevision } },
          ]);
          state.assert(epoch);
          requestOptions.signal?.throwIfAborted();

          return result;
        } catch (error) {
          requestOptions.signal?.throwIfAborted();
          if (!(error instanceof ClientSessionError)) state.assert(epoch);

          throw error;
        }
      };
    },
  });
  const contexts = new WeakMap<
    Request,
    { epoch: number; template: Request; tokenRevision: number }
  >();
  const unsubscribe = sync.subscribe(() => {
    try {
      state.assert();
    } catch {
      /* State notification already invalidated local credentials. */
    }
  });

  async function readRefresh() {
    const response = await refreshSession({
      client: raw,
      headers: { Origin: options.origin },
      throwOnError: true,
    });

    return response.data;
  }
  function expire(expected: number) {
    try {
      state.assertAuthority(expected);
    } catch {
      return;
    }
    state.invalidate('expired');
  }
  function refresh() {
    state.assert();
    if (pending) return pending;

    const { epoch, tokenRevision } = state.inspect();
    const work = sync
      .exclusive(async () => {
        state.assert(epoch);
        if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

        if (state.inspect().tokenRevision !== tokenRevision) return state.snapshot()!;

        return state.accept(await readRefresh(), 'refresh', epoch);
      })
      .catch((error: unknown) => {
        expire(epoch);
        if (error instanceof ClientSessionError) throw error;

        throw new ClientSessionError('UNAUTHENTICATED');
      })
      .finally(() => {
        if (pending === work) pending = undefined;
      });
    pending = work;

    return work;
  }

  async function authenticate(operation: () => Promise<{ data: SessionEnvelope }>) {
    if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

    const epoch = state.invalidate('login', true, true);
    try {
      return await sync.exclusive(async () => {
        state.assert(epoch, true);
        if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

        const response = await operation();

        return state.accept(response.data, 'login', epoch);
      });
    } catch (error) {
      expire(epoch);
      throw error;
    }
  }

  client.interceptors.request.use((request, requestOptions) => {
    if (!requestOptions.security?.some((scheme) => scheme.scheme === 'bearer')) return request;

    const context = (
      requestOptions as typeof requestOptions & {
        [stamp]?: { epoch: number; tokenRevision: number };
      }
    )[stamp];
    if (!context) throw new ClientSessionError('SESSION_CHANGED');

    state.assert(context.epoch);
    request.signal.throwIfAborted();
    contexts.set(request, { ...context, template: request.clone() });

    return request;
  });
  client.interceptors.response.use(async (response, request, requestOptions) => {
    const context = contexts.get(request);
    if (!context) return response;

    state.assert(context.epoch);
    if (response.status !== 401) return response;

    if (state.inspect().tokenRevision === context.tokenRevision)
      await cancellable(refresh(), request.signal);

    state.assert(context.epoch);
    request.signal.throwIfAborted();
    const headers = new Headers(context.template.headers);
    const token = state.inspect().session?.data.accessToken;
    if (!token) throw new ClientSessionError('UNAUTHENTICATED');

    headers.set('Authorization', `Bearer ${token}`);
    const retry = new Request(context.template, { headers, signal: request.signal });
    const retryFetch = requestOptions.fetch ?? fetchRequest;
    const result = await retryFetch(retry);
    state.assert(context.epoch);
    if (result.status === 401) {
      state.invalidate('expired');
      throw new ClientSessionError('UNAUTHENTICATED');
    }

    return result;
  });

  return {
    clearSession() {
      state.invalidate('logout');
    },
    client,
    dispose() {
      unsubscribe();
      state.invalidate('disposed', false);
    },
    getSession: state.snapshot,
    login: (body: LogInData['body']) =>
      authenticate(() =>
        logIn({ body, client: raw, headers: { Origin: options.origin }, throwOnError: true }),
      ),
    async logout() {
      const epoch = state.invalidate('logout');
      await sync.exclusive(async () => {
        state.assertAuthority(epoch);
        if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

        await logOut({ client: raw, headers: { Origin: options.origin }, throwOnError: true });
      });
    },
    refresh,
    setSession(value: SessionEnvelope) {
      return state.accept(value, 'login');
    },
    signup: (body: SignUpData['body']) =>
      authenticate(() =>
        signUp({ body, client: raw, headers: { Origin: options.origin }, throwOnError: true }),
      ),
    async switchWorkspace(workspaceId: string) {
      workspaceId = workspaceId.toLowerCase();
      state.assert();
      if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

      const source = state.snapshot();
      if (!source) throw new ClientSessionError('UNAUTHENTICATED');

      const epoch = state.invalidate('switch', true, true);
      try {
        return await sync.exclusive(async () => {
          state.assert(epoch, true);
          if (!sync.available) throw new ClientSessionError('COORDINATION_UNAVAILABLE');

          let response = await switchWorkspaceRequest({
            body: { workspaceId },
            client: raw,
            headers: { Origin: options.origin },
          });
          if (response.response?.status === 401) {
            const refreshed = await readRefresh();
            state.assert(epoch, true);
            if (
              refreshed.data.user.id !== source?.data.user.id ||
              refreshed.data.activeWorkspace?.id !== source?.data.activeWorkspace?.id
            )
              throw new ClientSessionError('SESSION_CHANGED');

            response = await switchWorkspaceRequest({
              auth: (scheme) =>
                scheme.scheme === 'bearer' ? refreshed.data.accessToken : undefined,
              body: { workspaceId },
              client: raw,
              headers: { Origin: options.origin },
            });
          }

          if (!response.data || response.data.data.activeWorkspace?.id !== workspaceId)
            throw new ClientSessionError('UNAUTHENTICATED');

          if (response.data.data.user.id !== source?.data.user.id)
            throw new ClientSessionError('SESSION_CHANGED');

          return state.accept(response.data, 'switch', epoch);
        });
      } catch (error) {
        expire(epoch);
        throw error;
      }
    },
  };
}

export { ClientSessionError } from './session-state.js';

export type { SessionChangeReason } from './session-state.js';

export type { SessionSync } from './session-sync.js';
