'use client';

import { ResolvedFieldCollectionSchema } from '@flowboard/contracts';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
} from '../config/configurationQueries';

import { readBoardStatuses } from './boardData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type {
  GetListResolvedFieldsQueryOptions,
  GetListResolvedStatusesQueryOptions,
} from '../config/configurationQueries';
import type { ResolvedField, ResolvedStatus } from '@flowboard/contracts';

const policy = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: Infinity,
} as const;

export type MoveDestinationQueryOptions = {
  fields?: GetListResolvedFieldsQueryOptions;
  statuses?: GetListResolvedStatusesQueryOptions;
};

export type MoveDestinationQueryResult =
  | { state: 'loading' }
  | { message: string; state: 'error' }
  | { fields: ResolvedField[]; state: 'ready'; statuses: ResolvedStatus[] };

export function useMoveDestination(
  runtime: ClientRuntime,
  scope: QueryScope,
  listId: string,
  configVersion: number,
  options: MoveDestinationQueryOptions = {},
): MoveDestinationQueryResult {
  const id = useId();
  const statusesQuery = useQuery({
    ...withQueryScope(
      getListResolvedStatusesOptions(
        { client: runtime.client, path: { listId } },
        { ...policy, ...options.statuses },
      ),
      scope,
      [id],
    ),
  });
  const fieldsQuery = useQuery({
    ...withQueryScope(
      getListResolvedFieldsOptions(
        { client: runtime.client, path: { listId } },
        { ...policy, ...options.fields },
      ),
      scope,
      [id],
    ),
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
