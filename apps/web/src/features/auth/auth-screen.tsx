'use client';

import { LogInSchema, SignUpSchema } from '@flowboard/contracts';
import { Alert, AuthPanel, Box, Button, FormField, Link, Stack } from '@flowboard/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { apiError } from '../../lib/api-error';
import { useSession } from '../../providers/app-providers';

import { SessionLoading } from './session-gate';

import type { ClientRuntime } from '../../providers/app-providers';
import type { LogIn, SignUp } from '@flowboard/contracts';
import type { Control, FieldValues, Path } from 'react-hook-form';

function AuthField<T extends FieldValues>({
  control,
  label,
  name,
  type = 'text',
  autoComplete,
}: {
  autoComplete: string;
  control: Control<T>;
  label: string;
  name: Path<T>;
  type?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField
          autoComplete={autoComplete}
          label={label}
          type={type}
          name={field.name}
          value={field.value}
          onBlur={field.onBlur}
          onChange={field.onChange}
          inputRef={field.ref}
          errorMessage={fieldState.error?.message}
          required
        />
      )}
    />
  );
}
function LoginForm({ runtime }: { runtime: ClientRuntime }) {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LogIn>({
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
    resolver: zodResolver(LogInSchema),
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
        <Stack spacing={5}>
          {error && <Alert severity="error">{error}</Alert>}
          <AuthField
            control={control}
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
          />
          <AuthField
            control={control}
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
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
  } = useForm<SignUp>({
    defaultValues: { email: '', password: '', name: '', workspaceName: '' },
    mode: 'onBlur',
    resolver: zodResolver(SignUpSchema),
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
        <Stack spacing={5}>
          {error && <Alert severity="error">{error}</Alert>}
          <AuthField control={control} name="name" label="Your name" autoComplete="name" />
          <AuthField
            control={control}
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
          />
          <AuthField
            control={control}
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
          />
          <AuthField
            control={control}
            name="workspaceName"
            label="Workspace name"
            autoComplete="organization"
          />
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
