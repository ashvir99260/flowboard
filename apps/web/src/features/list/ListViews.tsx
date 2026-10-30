'use client';

import { Suspense } from 'react';

import { SessionLoading } from '../auth/SessionLoading';

import { ConnectedListViews } from './ConnectedListViews';

type ListViewsProps = { listId: string };

export function ListViews({ listId }: ListViewsProps) {
  return (
    <Suspense fallback={<SessionLoading />}>
      <ConnectedListViews listId={listId} />
    </Suspense>
  );
}
