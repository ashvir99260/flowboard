import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { StatusScope } from '@flowboard/contracts';
import type { ComponentType } from 'react';

export type ConfigurationEditorProps = {
  active: boolean;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  owner: StatusScope;
  runtime: ClientRuntime;
  scope: QueryScope;
};

export type ConfigurationSettingsProps = {
  active: boolean;
  Editor: ComponentType<ConfigurationEditorProps>;
  kind: 'status' | 'field';
};
