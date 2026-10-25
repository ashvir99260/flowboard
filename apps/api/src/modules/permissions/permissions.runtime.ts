import type { CursorCodec } from '../../core/common/cursor.ts';
import type { Database, IdentityRepository } from '@flowboard/database';

export const PermissionsRuntimeKey = 'flowboard:permissions-runtime';

export interface PermissionsRuntime {
  cursor?: CursorCodec;
  database?: Database;
  identities?: IdentityRepository;
}
