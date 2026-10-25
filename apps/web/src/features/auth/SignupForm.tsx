'use client';

import { SignUpSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, AuthPanel, Box, Button, Link, Stack } from '@flowboard/ui';
import NextLink from 'next/link';
import { useState } from 'react';

import { apiError } from '../../lib/apiError';
import { useSession } from '../../providers/useSession';

import { signupFields } from './authFormFields';

export function SignupForm() {
  const { signup } = useSession();
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
            await signup(data);
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
