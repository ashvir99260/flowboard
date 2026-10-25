import type { LogIn, SignUp } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';

export const loginFields = [
  { kind: 'email', name: 'email', label: 'Email', autoComplete: 'email', required: true },
  {
    kind: 'password',
    name: 'password',
    label: 'Password',
    autoComplete: 'current-password',
    required: true,
  },
] satisfies FormFieldConfig<LogIn>[];

export const signupFields = [
  { kind: 'text', name: 'name', label: 'Your name', autoComplete: 'name', required: true },
  loginFields[0]!,
  {
    kind: 'password',
    name: 'password',
    label: 'Password',
    autoComplete: 'new-password',
    required: true,
  },
  {
    kind: 'text',
    name: 'workspaceName',
    label: 'Workspace name',
    autoComplete: 'organization',
    required: true,
  },
] satisfies FormFieldConfig<SignUp>[];
