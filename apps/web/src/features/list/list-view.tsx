'use client';

import { Button, Stack, Typography } from '@flowboard/ui';
import { ErrorState } from '@flowboard/ui';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';

import { useSession } from '../../providers/app-providers';
import { SessionLoading } from '../auth/session-gate';
import { Board } from '../board/board';
import { useTaskEditor } from '../tasks/task-drawer';

import { readListLocation, writeListLocation } from './list-location';
import { ListResult } from './list-result';
import { ListToolbar } from './list-toolbar';
import { useListQuery } from './use-list-query';

import type { TaskTableQuery } from './list-location';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { ReactNode } from 'react';

function ConnectedList({
  listId,
  runtime,
  scope,
  query,
  onChange,
  pending,
}: {
  listId: string;
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const view = useListQuery({ listId, runtime, scope, query });

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}
      >
        <Typography component="h2" variant="h2">
          Tasks
        </Typography>
        <Button disabled={pending} onClick={view.retry}>
          Refresh tasks
        </Button>
      </Stack>
      <ListToolbar
        fields={view.fields}
        configured={view.configured}
        query={query}
        onChange={onChange}
        pending={pending}
      />
      <ListResult view={view} />
    </Stack>
  );
}

function ViewLink({
  active,
  href,
  children,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Button
      component={NextLink}
      href={href}
      aria-current={active ? 'page' : undefined}
      variant={active ? 'contained' : 'outlined'}
    >
      {children}
    </Button>
  );
}

function ViewContent({
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

function Views({ listId }: { listId: string }) {
  const openTask = useTaskEditor();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runtime, scope } = useSession();
  const location = readListLocation(search.toString());
  const listQuery = location.ok
    ? location.query
    : { sort: 'dueDate' as const, direction: 'asc' as const };
  const onChange = (query: TaskTableQuery) =>
    startTransition(() =>
      router.push(`${pathname}?${writeListLocation(query)}`, { scroll: false }),
    );

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0 }}>
      <Stack component="nav" aria-label="List views" direction="row" spacing={0.8}>
        <ViewLink active={location.ok && location.view === 'board'} href={pathname}>
          Board
        </ViewLink>
        <ViewLink
          active={location.ok && location.view === 'list'}
          href={`${pathname}?${writeListLocation(listQuery)}`}
        >
          List
        </ViewLink>
        <Button onClick={() => openTask(null)}>New task</Button>
      </Stack>
      <ViewContent
        location={location}
        pathname={pathname}
        listId={listId}
        runtime={runtime}
        scope={scope}
        pending={pending}
        onChange={onChange}
      />
    </Stack>
  );
}

export function ListViews({ listId }: { listId: string }) {
  return (
    <Suspense fallback={<SessionLoading />}>
      <Views listId={listId} />
    </Suspense>
  );
}
