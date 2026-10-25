'use client';

import { Button, ErrorState } from '@flowboard/ui';
import NextLink from 'next/link';

import { SessionLoading } from '../auth/SessionLoading';
import { Board } from '../board/Board';

import { ConnectedList } from './ConnectedList';
import { readListLocation } from './listLocation';

import type { TaskTableQuery } from './listLocation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function ListViewContent({
  location,
  pathname,
  listId,
  runtime,
  scope,
  pending,
  onChange,
}: {
  listId: string;
  location: ReturnType<typeof readListLocation>;
  onChange: (query: TaskTableQuery) => void;
  pathname: string;
  pending: boolean;
  runtime: ClientRuntime | null;
  scope: QueryScope | null;
}) {
  if (!location.ok)
    return (
      <ErrorState
        title="Invalid list options"
        description={location.message}
        action={
          <Button component={NextLink} href={pathname}>
            Reset view
          </Button>
        }
      />
    );

  if (location.view === 'board') return <Board listId={listId} />;

  if (!runtime || !scope) return <SessionLoading />;

  return (
    <ConnectedList
      key={`${scope.revision}:${scope.userId}:${scope.workspaceId}:${listId}`}
      listId={listId}
      runtime={runtime}
      scope={scope}
      query={location.query}
      onChange={onChange}
      pending={pending}
    />
  );
}
