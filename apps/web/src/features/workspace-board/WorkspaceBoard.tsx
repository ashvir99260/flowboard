'use client';

import { useSession } from '../../providers/useSession';
import { ConnectedWorkspaceBoard } from './ConnectedWorkspaceBoard';

export function WorkspaceBoard() {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <ConnectedWorkspaceBoard
      key={`${scope.revision}:${scope.userId}:${scope.workspaceId}`}
      runtime={runtime}
      scope={scope}
    />
  ) : null;
}
