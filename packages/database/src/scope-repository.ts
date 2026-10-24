import { resolveVisibleTree, StatusScopeSchema } from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';

import type { Prisma } from './generated/client.js';
import type { NodeRecord } from './repositories.js';
import type { TenantContext } from './tenant-context.js';
import type { StatusScope } from '@flowboard/contracts';

export function scopeRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
  nodePath: (id: string) => Promise<NodeRecord[] | null>,
) {
  const { workspaceId } = context;
  const root: StatusScope = { ownerType: 'workspace', ownerId: workspaceId };

  return Object.freeze({
    async path(input: StatusScope): Promise<StatusScope[]> {
      assertActive();
      const owner = StatusScopeSchema.parse(input);
      if (owner.ownerType === 'workspace') {
        if (owner.ownerId !== workspaceId) throw new DatabaseError('NOT_FOUND', 'Scope not found');

        return [root];
      }

      const nodes = await nodePath(owner.ownerId);
      if (!nodes || nodes.at(-1)?.type !== owner.ownerType)
        throw new DatabaseError('NOT_FOUND', 'Scope not found');

      return [root, ...nodes.map((node) => ({ ownerType: node.type, ownerId: node.id }))];
    },
    async affectedPaths(owner: StatusScope): Promise<StatusScope[][]> {
      assertActive();
      const nodes = await tx.node.findMany({ where: { workspaceId, archivedAt: null } });
      const byId = new Map(nodes.map((node) => [node.id, node]));

      return [
        [root],
        ...resolveVisibleTree(nodes, [], workspaceId, 'admin').map((entry) => [
          root,
          ...entry.path.map((part) => ({ ownerId: part.id, ownerType: byId.get(part.id)!.type })),
        ]),
      ].filter((scopes) =>
        scopes.some(
          (scope) => scope.ownerId === owner.ownerId && scope.ownerType === owner.ownerType,
        ),
      );
    },
  });
}
