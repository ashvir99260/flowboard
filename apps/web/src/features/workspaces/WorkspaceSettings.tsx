'use client';

import { ErrorState } from '@flowboard/ui';
import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';
import { WorkspaceSettingsContent } from './WorkspaceSettingsContent';

export function WorkspaceSettings() {
  const { runtime, scope, session } = useSession();

  if (!runtime || !scope) return <SessionLoading />;

  if (session?.data.activeWorkspace?.role !== 'admin')
    return (
      <ErrorState
        description="Only workspace administrators can manage this workspace."
        title="Access denied"
      />
    );

  return <WorkspaceSettingsContent key={JSON.stringify(scope)} runtime={runtime} scope={scope} />;
}
