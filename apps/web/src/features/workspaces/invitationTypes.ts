import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export type InvitationFormState = { busy: boolean; dirty: boolean };

export type InvitationContext = { runtime: ClientRuntime; scope: QueryScope };
