'use client';

import { Stack } from '@flowboard/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { useSession } from '../../providers/useSession';
import { ListViewContent } from './ListViewContent';
import { ListViewLink } from './ListViewLink';
import { readListLocation, writeListLocation } from './listLocation';

import type { TaskTableQuery } from './listLocation';

export function ConnectedListViews({ listId }: { listId: string }) {
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
        <ListViewLink active={location.ok && location.view === 'board'} href={pathname}>
          Board
        </ListViewLink>
        <ListViewLink
          active={location.ok && location.view === 'list'}
          href={`${pathname}?${writeListLocation(listQuery)}`}
        >
          List
        </ListViewLink>
      </Stack>
      <ListViewContent
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
