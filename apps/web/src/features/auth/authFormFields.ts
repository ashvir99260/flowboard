import type { LogIn, SignUp } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';

export const loginFields = [
  { autoComplete: 'email', kind: 'email', label: 'Email', name: 'email', required: true },
  {
    autoComplete: 'current-password',
    kind: 'password',
    label: 'Password',
    name: 'password',
    required: true,
  },
] satisfies FormFieldConfig<LogIn>[];

export const signupFields = [
  { autoComplete: 'name', kind: 'text', label: 'Your name', name: 'name', required: true },
  loginFields[0]!,
  {
    autoComplete: 'new-password',
    kind: 'password',
    label: 'Password',
    name: 'password',
    required: true,
  },
  {
    autoComplete: 'organization',
    kind: 'text',
    label: 'Workspace name',
    name: 'workspaceName',
    required: true,
  },
] satisfies FormFieldConfig<SignUp>[];
