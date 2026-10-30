'use client';

import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';

import { SelectedList } from './SelectedList';

type ListDetailsProps = { listId: string };

export function ListDetails({ listId }: ListDetailsProps) {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <SelectedList key={listId} listId={listId} runtime={runtime} scope={scope} />
  ) : (
    <SessionLoading />
  );
}
