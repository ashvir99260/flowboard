'use client';

import { LogInSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, AuthPanel, Box, Button, Link, Stack } from '@flowboard/ui';
import NextLink from 'next/link';
import { useState } from 'react';

import { apiError } from '../../lib/apiError';
import { useSession } from '../../providers/useSession';

import { loginFields } from './authFormFields';

export function LoginForm() {
  const { login } = useSession();
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
            await login(data);
          } catch (cause) {
            const failure = apiError(cause);
            setError(failure.message);
          }
        })}
      >
        <Stack spacing={2}>
          {error && (
            <Alert aria-live="off" severity="error">
              {error}
            </Alert>
          )}
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
