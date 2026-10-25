'use client';

import { Stack } from '@flowboard/ui';
import { usePathname, useSearchParams } from 'next/navigation';

import { useSession } from '../../providers/useSession';

import { readListLocation, writeListLocation } from './listLocation';
import { ListViewContent } from './ListViewContent';
import { ListViewLink } from './ListViewLink';

import type { TaskTableQuery } from './listLocation';

export function ConnectedListViews({ listId }: { listId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { runtime, scope } = useSession();

  const location = readListLocation(search.toString());
  const listQuery = location.ok
    ? location.query
    : { sort: 'dueDate' as const, direction: 'asc' as const };
  const onChange = (query: TaskTableQuery) =>
    window.history.pushState(null, '', `${pathname}?${writeListLocation(query)}`);

  return (
    <Stack spacing={1.2} sx={{ minWidth: 0 }}>
      <Stack
        component="nav"
        aria-label="List views"
        direction="row"
        spacing={0.4}
        sx={{ alignSelf: 'flex-start', p: 0.4, border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <ListViewLink
          active={location.ok && location.view === 'board'}
          href={pathname}
          view="board"
        />
        <ListViewLink
          active={location.ok && location.view === 'list'}
          href={`${pathname}?${writeListLocation(listQuery)}`}
          view="list"
        />
      </Stack>
      <ListViewContent
        location={location}
        pathname={pathname}
        listId={listId}
        runtime={runtime}
        scope={scope}
        pending={false}
        onChange={onChange}
      />
    </Stack>
  );
}
