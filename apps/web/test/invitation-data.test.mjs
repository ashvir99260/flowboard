import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InvitationDraftSchema,
  invitationLink,
  readCreatedInvitation,
  readInvitationFragment,
} from '../src/features/workspaces/invitationData.ts';

const token = 'A'.repeat(43);
const response = {
  configVersion: 5,
  data: {
    invitationId: '10000000-0000-4000-8000-000000000001',
    token,
    expiresAt: '2027-10-26T10:00:00.000Z',
  },
};

test('invitation drafts use normalized shared email and role validation', () => {
  assert.deepEqual(InvitationDraftSchema.parse({ email: ' Member@Example.com ', role: 'member' }), {
    email: 'member@example.com',
    role: 'member',
  });
  assert.equal(
    InvitationDraftSchema.safeParse({ email: 'invalid', role: 'member' }).success,
    false,
  );
  assert.equal(
    InvitationDraftSchema.safeParse({ email: 'member@example.com', role: 'owner' }).success,
    false,
  );
});

test('invitation links keep the secret only in a strict fragment', () => {
  const url = new URL(invitationLink(token, 'http://localhost:3300'));
  assert.equal(url.pathname, '/invitations/accept');
  assert.equal(url.search, '');
  assert.equal(readInvitationFragment(url.hash), token);
  for (const fragment of [
    '',
    '#token=bad',
    `#token=${token}&extra=1`,
    `#token=${token}&token=${token}`,
  ])
    assert.equal(readInvitationFragment(fragment), null);
});

test('created invitations require the server revision and valid token shape', () => {
  assert.deepEqual(readCreatedInvitation(response, 4), response);
  assert.equal(readCreatedInvitation(response, 5), null);
  assert.equal(
    readCreatedInvitation({ ...response, data: { ...response.data, token: 'invalid' } }, 4),
    null,
  );
});
