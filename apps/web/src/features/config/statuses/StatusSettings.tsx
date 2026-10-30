'use client';

import { ConfigurationSettings } from '../ConfigurationSettings';

import { StatusScopeConfiguration } from './StatusScopeConfiguration';

type StatusSettingsProps = { active?: boolean };

export function StatusSettings({ active = true }: StatusSettingsProps) {
  return <ConfigurationSettings active={active} kind="status" Editor={StatusScopeConfiguration} />;
}
