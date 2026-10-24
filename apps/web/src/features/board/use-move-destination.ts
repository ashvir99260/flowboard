'use client';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
} from '@flowboard/api-client/tanstack-query';
import { ResolvedFieldCollectionSchema } from '@flowboard/contracts';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';

import { readBoardStatuses } from './board-data';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

const policy = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: Infinity,
} as const;

export function useMoveDestination(
  runtime: ClientRuntime,
  scope: QueryScope,
  listId: string,
  configVersion: number,
) {
  const id = useId();
  const statusesQuery = useQuery({
    ...withQueryScope(
      getListResolvedStatusesOptions({ client: runtime.client, path: { listId } }),
      scope,
      [id],
    ),
    ...policy,
  });
  const fieldsQuery = useQuery({
    ...withQueryScope(
      getListResolvedFieldsOptions({ client: runtime.client, path: { listId } }),
      scope,
      [id],
    ),
    ...policy,
  });
  if (statusesQuery.isPending || fieldsQuery.isPending) return { state: 'loading' as const };

  const failure = statusesQuery.error ?? fieldsQuery.error;
  if (failure) return { state: 'error' as const, message: apiError(failure).message };

  const statuses = readBoardStatuses(statusesQuery.data, scope.workspaceId!);
  const fields = ResolvedFieldCollectionSchema.safeParse(fieldsQuery.data);
  if (
    statuses.state !== 'ready' ||
    !fields.success ||
    fields.data.items.some((field) => field.workspaceId !== scope.workspaceId)
  )
    return { state: 'error' as const, message: 'Destination configuration is unavailable.' };

  if (statuses.configVersion !== configVersion || fields.data.configVersion !== configVersion)
    return {
      state: 'error' as const,
      message:
        'Configuration changed. Close this dialog and refresh the board before trying again.',
    };

  return { state: 'ready' as const, statuses: statuses.items, fields: fields.data.items };
}
