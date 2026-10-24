'use client';

import { listScopeStatusesOptions } from '@flowboard/api-client/tanstack-query';
import { ScopeStatusCollectionSchema } from '@flowboard/contracts';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { apiError } from '../../../lib/api-error';
import { withQueryScope } from '../../../lib/query-scope';

import { readStatusConfiguration } from './status-configuration';

import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { StatusScope } from '@flowboard/contracts';

const policy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
export function useStatusConfiguration(
  runtime: ClientRuntime,
  scope: QueryScope,
  owner: StatusScope,
) {
  const id = useId();
  const [attempt, setAttempt] = useState({ generation: 0, restarts: 0 });
  const options = (target: StatusScope) => ({
    ...withQueryScope(listScopeStatusesOptions({ client: runtime.client, path: target }), scope, [
      `status-config:${id}:${attempt.generation}`,
    ]),
    ...policy,
  });
  const selected = useQuery(options(owner));
  const parsed = ScopeStatusCollectionSchema.safeParse(selected.data);
  const ancestors = parsed.success ? parsed.data.ancestorScopes : [];
  const queries = useQueries({ queries: ancestors.map(options) });
  const result = readStatusConfiguration({
    workspaceId: scope.workspaceId!,
    scope: owner,
    collections: [
      { scope: owner, data: selected.data },
      ...ancestors.map((target, index) => ({ scope: target, data: queries[index]?.data })),
    ],
  });
  const failed = [selected, ...queries].find((query) => query.isError);
  const error = failed ? apiError(failed.error) : null;
  const retry = () =>
    setAttempt((current) => ({ generation: current.generation + 1, restarts: 0 }));
  if (result.state === 'stale' && attempt.restarts < 2) {
    setAttempt({ generation: attempt.generation + 1, restarts: attempt.restarts + 1 });

    return { result: { state: 'pending' as const }, error: null, retry };
  }

  return { result, error, retry };
}
