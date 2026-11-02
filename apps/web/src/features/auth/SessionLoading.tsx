'use client';

import { LoadingState, WorkspaceSkeleton } from '@flowboard/ui';

export function SessionLoading({ layout = 'content' }: { layout?: 'content' | 'workspace' }) {
  return layout === 'workspace' ? (
    <WorkspaceSkeleton />
  ) : (
    <LoadingState>Opening Flowboard…</LoadingState>
  );
}
