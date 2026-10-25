'use client';

import { useSession } from '../../providers/useSession';

import { ConnectedBoard } from './ConnectedBoard';

export function Board({ listId }: { listId: string }) {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <ConnectedBoard
      key={`${scope.revision}:${scope.userId}:${scope.workspaceId}:${listId}`}
      listId={listId}
      runtime={runtime}
      scope={scope}
    />
  ) : null;
}
