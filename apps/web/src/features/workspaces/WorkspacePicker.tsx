'use client';

import { useSession } from '../../providers/useSession';
import { SessionGate } from '../auth/SessionGate';
import { WorkspaceMemberships } from './WorkspaceMemberships';

export function WorkspacePicker() {
  const { runtime, scope } = useSession();

  return (
    <SessionGate>
      {runtime && scope && (
        <WorkspaceMemberships key={JSON.stringify(scope)} runtime={runtime} scope={scope} />
      )}
    </SessionGate>
  );
}
