import type { CursorCodec } from '../../core/common/cursor.js';
import type { Database, IdentityRepository } from '@flowboard/database';

export const WorkspacesRuntimeKey = Symbol('WorkspacesRuntime');

export interface WorkspacesRuntime {
  cursor: CursorCodec | undefined;
  database: Database | undefined;
  identities: IdentityRepository | undefined;
}
