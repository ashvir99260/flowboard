'use client';

import { ErrorState } from '@flowboard/ui';

import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';
import { AdministrationWorkspace } from './AdministrationWorkspace';

export function AdministrationSettings({ active }: { active: boolean }) {
  const { runtime, scope, session } = useSession();
  if (!runtime || !scope) return <SessionLoading />;

  if (session?.data.activeWorkspace?.role !== 'admin')
    return (
      <ErrorState
        title="Access denied"
        description="Only workspace administrators can manage containers and grants."
      />
    );

  return (
    <AdministrationWorkspace
      key={JSON.stringify(scope)}
      runtime={runtime}
      scope={scope}
      active={active}
    />
  );
}
