import type { QueryScope } from '../../lib/queryScope';
import type { QueryClient } from '@tanstack/react-query';

function sameScope(key: readonly unknown[] | undefined, scope: QueryScope) {
  return (
    key &&
    ['task-placement', 'task-write'].includes(String(key[0])) &&
    key[1] === scope.revision &&
    key[2] === scope.userId &&
    key[3] === scope.workspaceId
  );
}

export function taskMutationAffectsList(
  key: readonly unknown[] | undefined,
  variables: unknown,
  scope: QueryScope,
  listId: string,
) {
  if (!sameScope(key, scope) || !variables || typeof variables !== 'object') return false;

  const command = variables as {
    listId?: string;
    request?: { destinationListId?: string };
    sourceListId?: string;
  };

  return (
    command.listId === listId ||
    command.sourceListId === listId ||
    command.request?.destinationListId === listId
  );
}

export function isTaskBusy(client: QueryClient, scope: QueryScope, taskId: string) {
  return (
    client.isMutating({
      predicate: (entry) => {
        const variables = entry.state.variables as
          { taskId?: string; tasks?: readonly { id: string }[] } | undefined;

        return Boolean(
          sameScope(entry.options.mutationKey, scope) &&
          (variables?.taskId === taskId || variables?.tasks?.some(({ id }) => id === taskId)),
        );
      },
    }) > 0
  );
}
