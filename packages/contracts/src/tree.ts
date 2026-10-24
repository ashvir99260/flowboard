import { z } from 'zod';

import { PositionSchema, UuidSchema } from './identifiers.js';
import { ContainerParentType, NodeEnvelopeSchema, NodeSchema } from './nodes.js';
import { cursorPageSchema } from './pagination.js';

import type { ContainerType, PermissionMode, Visibility, WorkspaceRole } from './enums.js';

export const TreePositionSchema = z
  .array(z.strictObject({ id: UuidSchema, position: PositionSchema }))
  .min(1)
  .max(3);

export const TreePageSchema = cursorPageSchema(NodeSchema)
  .extend({
    configVersion: NodeEnvelopeSchema.shape.configVersion,
    dataVersion: NodeEnvelopeSchema.shape.dataVersion,
    root: NodeSchema.pick({ id: true, name: true })
      .extend({
        type: z.literal('workspace').meta({
          description: 'Virtual workspace root.',
          example: 'workspace',
          title: 'Root type',
        }),
      })
      .meta({
        title: 'Workspace root',
        description: 'Selected workspace from the same snapshot.',
        example: {
          id: '10000000-0000-4000-8000-000000000002',
          name: 'Engineering',
          type: 'workspace',
        },
      }),
  })
  .meta({
    title: 'Visible tree page',
    description: 'Authorized live nodes ordered by depth and full sibling path.',
    example: {
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      configVersion: 1,
      dataVersion: 1,
      root: { id: '10000000-0000-4000-8000-000000000002', name: 'Engineering', type: 'workspace' },
    },
  });

export type TreePage = z.infer<typeof TreePageSchema>;

export type TreePosition = z.infer<typeof TreePositionSchema>;

interface VisibilityNode {
  archivedAt: unknown;
  id: string;
  parentId: string | null;
  position: number;
  type: ContainerType;
  visibility: Visibility;
  workspaceId: string;
}

/** Breadth first, with numeric positions and ID ties at every ancestor level. */
export function compareTreePositions(left: TreePosition, right: TreePosition): number {
  if (left.length !== right.length) return left.length - right.length;

  for (const [index, part] of left.entries()) {
    const other = right[index];
    if (!other) return 1;

    const order = part.position - other.position || part.id.localeCompare(other.id);
    if (order !== 0) return order;
  }

  return 0;
}

/** Input grants belong to the actor only. Missing, cyclic or malformed chains fail closed. */
export function resolveVisibleTree<T extends VisibilityNode>(
  nodes: readonly T[],
  grants: readonly { mode: PermissionMode; resourceId: string }[],
  workspaceId: string,
  role: WorkspaceRole,
): { node: T; path: TreePosition }[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const modes = new Map(grants.map((grant) => [grant.resourceId, grant.mode]));
  const paths = new Map<string, TreePosition | null>();
  const visiting = new Set<string>();
  function pathFor(node: T): TreePosition | null {
    if (paths.has(node.id)) return paths.get(node.id) ?? null;

    if (visiting.has(node.id)) return null;

    visiting.add(node.id);
    const parent = node.parentId === null ? undefined : byId.get(node.parentId);
    const parentPath = parent ? pathFor(parent) : [];
    const valid =
      node.workspaceId === workspaceId &&
      node.archivedAt === null &&
      (parent?.type ?? null) === ContainerParentType[node.type] &&
      (node.parentId === null || parent !== undefined) &&
      parentPath !== null &&
      (role === 'admin' ||
        (modes.get(node.id) !== 'deny' &&
          (node.visibility === 'public' || modes.get(node.id) === 'allow')));
    const path =
      valid && parentPath ? [...parentPath, { id: node.id, position: node.position }] : null;
    visiting.delete(node.id);
    paths.set(node.id, path);

    return path;
  }

  return nodes
    .flatMap((node) => {
      const path = pathFor(node);

      return path ? [{ node, path }] : [];
    })
    .sort((left, right) => compareTreePositions(left.path, right.path));
}
