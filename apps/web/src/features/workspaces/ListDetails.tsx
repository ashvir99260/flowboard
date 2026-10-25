'use client';

import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';
import { SelectedList } from './SelectedList';

export function ListDetails({ listId }: { listId: string }) {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <SelectedList key={listId} listId={listId} runtime={runtime} scope={scope} />
  ) : (
    <SessionLoading />
  );
}
