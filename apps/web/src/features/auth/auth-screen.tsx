'use client';

import { LogInSchema, SignUpSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, AuthPanel, Box, Button, Link, Stack } from '@flowboard/ui';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useSession } from '../../providers/app-providers';

import { SessionLoading } from './session-gate';

import type { ClientRuntime } from '../../providers/app-providers';
import type { LogIn, SignUp } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';

const loginFields = [
  { kind: 'email', name: 'email', label: 'Email', autoComplete: 'email', required: true },
  {
    kind: 'password',
    name: 'password',
    label: 'Password',
    autoComplete: 'current-password',
    required: true,
  },
] satisfies FormFieldConfig<LogIn>[];
const signupFields = [
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

function LoginForm({ runtime }: { runtime: ClientRuntime }) {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useZodForm(LogInSchema, {
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  return (
    <AuthPanel title="Sign in to Flowboard">
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit(async (data) => {
          setError(null);
          try {
            await runtime.login(data);
          } catch (cause) {
            setError(apiError(cause).message);
          }
        })}
      >
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormFields control={control} fields={loginFields} disabled={isSubmitting} />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Sign in
          </Button>
          <Link component={NextLink} href="/signup">
            Create an account
          </Link>
        </Stack>
      </Box>
    </AuthPanel>
  );
}
function SignupForm({ runtime }: { runtime: ClientRuntime }) {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useZodForm(SignUpSchema, {
    defaultValues: { email: '', password: '', name: '', workspaceName: '' },
    mode: 'onBlur',
  });

  return (
    <AuthPanel title="Create your workspace">
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit(async (data) => {
          setError(null);
          try {
            await runtime.signup(data);
          } catch (cause) {
            setError(apiError(cause).message);
          }
        })}
      >
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormFields control={control} fields={signupFields} disabled={isSubmitting} />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Create account
          </Button>
          <Link component={NextLink} href="/login">
            Already have an account? Sign in
          </Link>
        </Stack>
      </Box>
    </AuthPanel>
  );
}

export function AuthScreen({ mode }: Readonly<{ mode: 'login' | 'signup' }>) {
  const { runtime, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspaces');
  }, [router, status]);
  if (!runtime || status === 'booting' || status === 'authenticated') return <SessionLoading />;

  return mode === 'login' ? <LoginForm runtime={runtime} /> : <SignupForm runtime={runtime} />;
}
