'use client';

import { ConfigurationSettings } from '../ConfigurationSettings';
import { StatusScopeConfiguration } from './StatusScopeConfiguration';

export function StatusSettings({ active = true }: { active?: boolean }) {
  return <ConfigurationSettings active={active} kind="status" Editor={StatusScopeConfiguration} />;
}
