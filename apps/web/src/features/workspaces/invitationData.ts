import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
  InvitationEnvelopeSchema,
} from '@flowboard/contracts';

export const InvitationDraftSchema = CreateInvitationSchema.omit({ expectedConfigVersion: true });

export function readCreatedInvitation(value: unknown, expectedConfigVersion: number) {
  const parsed = InvitationEnvelopeSchema.safeParse(value);
  if (!parsed.success || parsed.data.configVersion !== expectedConfigVersion + 1) return null;

  return parsed.data;
}

export function invitationLink(token: string, origin: string) {
  const input = AcceptInvitationSchema.parse({ token });
  const url = new URL('/invitations/accept', origin);
  url.hash = new URLSearchParams(input).toString();

  return url.toString();
}

export function readInvitationFragment(fragment: string): string | null {
  const parameters = new URLSearchParams(fragment.replace(/^#/, ''));
  if (parameters.size !== 1 || !parameters.has('token')) return null;

  const parsed = AcceptInvitationSchema.safeParse({ token: parameters.get('token') });

  return parsed.success ? parsed.data.token : null;
}
