'use client';

import { ScopeStatusCollectionSchema } from '@flowboard/contracts';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { apiError } from '../../../lib/apiError';
import { withQueryScope } from '../../../lib/queryScope';
import { listScopeStatusesOptions } from '../configurationQueries';

import { readStatusConfiguration } from './statusConfiguration';

import type { QueryScope } from '../../../lib/queryScope';
import type { ClientRuntime } from '../../../providers/sessionContext';
import type { ListScopeStatusesQueryOptions } from '../configurationQueries';
import type { StatusScope } from '@flowboard/contracts';

const policy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
export type StatusConfigurationQueryOptions = ListScopeStatusesQueryOptions;

export type StatusConfigurationQueryResult = {
  error: ReturnType<typeof apiError> | null;
  result: ReturnType<typeof readStatusConfiguration>;
  retry: () => void;
};

export function useStatusConfiguration(
  runtime: ClientRuntime,
  scope: QueryScope,
  owner: StatusScope,
  options: StatusConfigurationQueryOptions = {},
): StatusConfigurationQueryResult {
  const id = useId();
  const [attempt, setAttempt] = useState({ generation: 0, restarts: 0 });

  const queryOptions = (target: StatusScope) => ({
    ...withQueryScope(
      listScopeStatusesOptions({ client: runtime.client, path: target }, { ...policy, ...options }),
      scope,
      [`status-config:${id}:${attempt.generation}`],
    ),
  });

  const selected = useQuery(queryOptions(owner));

  const parsed = ScopeStatusCollectionSchema.safeParse(selected.data);
  const ancestors = parsed.success ? parsed.data.ancestorScopes : [];

  const queries = useQueries({ queries: ancestors.map(queryOptions) });

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
