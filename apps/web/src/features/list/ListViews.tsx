'use client';

import { Suspense } from 'react';

import { SessionLoading } from '../auth/SessionLoading';

import { ConnectedListViews } from './ConnectedListViews';

export function ListViews({ listId }: { listId: string }) {
  return (
    <Suspense fallback={<SessionLoading />}>
      <ConnectedListViews listId={listId} />
    </Suspense>
  );
}
