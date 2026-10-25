'use client';

import { ConfigurationSettings } from '../ConfigurationSettings';
import { FieldScopeConfiguration } from './FieldScopeConfiguration';

export function FieldSettings({ active = true }: { active?: boolean }) {
  return <ConfigurationSettings active={active} kind="field" Editor={FieldScopeConfiguration} />;
}
