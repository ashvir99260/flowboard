import { expect, test } from '@jest/globals';

import { LogInSchema, SignUpSchema } from '../dist/index.js';

test('auth inputs normalize email and names but preserve password whitespace', () => {
  expect(
    LogInSchema.parse({ email: ' USER@Example.com ', password: ' password with spaces ' }),
  ).toEqual({ email: 'user@example.com', password: ' password with spaces ' });
  expect(
    SignUpSchema.parse({
      email: 'user@example.com',
      name: ' Alice ',
      password: ' password with spaces ',
      workspaceName: ' Team ',
    }).name,
  ).toBe('Alice');
});
test('auth inputs reject injected ownership, missing fields and oversized credentials', () => {
  const input = { email: 'user@example.com', password: 'strong password' };
  for (const value of [
    { ...input, role: 'admin' },
    { ...input, workspaceId: 'attacker' },
    { ...input, password: 'short' },
    { ...input, password: 'x'.repeat(129) },
    { ...input, email: 'not-an-email' },
  ])
    expect(LogInSchema.safeParse(value).success).toBe(false);
  expect(SignUpSchema.safeParse(input).success).toBe(false);
});

test('cookie actions accept only an empty body, including omitted JSON', async () => {
  const { EmptyAuthBodySchema } = await import('../dist/index.js');
  expect(EmptyAuthBodySchema.parse(undefined)).toEqual({});
  expect(EmptyAuthBodySchema.parse({})).toEqual({});
  expect(EmptyAuthBodySchema.safeParse({ userId: 'forged' }).success).toBe(false);
});
