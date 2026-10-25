import type { QueryScope } from '../../lib/queryScope';

export function configurationChanged(
  key: readonly unknown[] | undefined,
  action: string,
  scope: QueryScope,
) {
  return (
    ['success', 'error'].includes(action) &&
    key?.[0] === 'configuration-write' &&
    key[1] === scope.revision &&
    key[2] === scope.userId &&
    key[3] === scope.workspaceId
  );
}
