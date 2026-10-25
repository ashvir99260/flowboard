'use client';

import { ErrorState } from '@flowboard/ui';

import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';
import { ConnectedConfigurationSettings } from './ConnectedConfigurationSettings';

import type { ConfigurationSettingsProps } from './configurationTypes';

export type { ConfigurationEditorProps } from './configurationTypes';

export function ConfigurationSettings(props: ConfigurationSettingsProps) {
  const { runtime, scope, session } = useSession();

  if (!runtime || !scope) return <SessionLoading />;

  if (session?.data.activeWorkspace?.role !== 'admin')
    return (
      <ErrorState
        title="Access denied"
        description={`Only workspace administrators can configure ${props.kind === 'status' ? 'statuses' : 'fields'}. Effective configuration remains visible on each list.`}
      />
    );

  return <ConnectedConfigurationSettings {...props} runtime={runtime} scope={scope} />;
}
