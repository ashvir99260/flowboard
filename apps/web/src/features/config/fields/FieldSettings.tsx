'use client';

import { ConfigurationSettings } from '../ConfigurationSettings';

import { FieldScopeConfiguration } from './FieldScopeConfiguration';

type FieldSettingsProps = { active?: boolean };

export function FieldSettings({ active = true }: FieldSettingsProps) {
  return <ConfigurationSettings active={active} kind="field" Editor={FieldScopeConfiguration} />;
}
