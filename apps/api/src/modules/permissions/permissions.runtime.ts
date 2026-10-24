import type { CursorCodec } from '../../core/common/cursor.ts';
import type { Database } from '@flowboard/database';

export const PermissionsRuntimeKey = 'flowboard:permissions-runtime';

export interface PermissionsRuntime {
  cursor?: CursorCodec;
  database?: Database;
}
