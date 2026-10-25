import { ContainerParentType, TreePageSchema } from '@flowboard/contracts';

import type { NodeSchema, TreePage } from '@flowboard/contracts';

type ContainerNode = ReturnType<typeof NodeSchema.parse>;

export interface TreeBranch {
  readonly children: readonly TreeBranch[];
  readonly node: ContainerNode;
}

type TreeResult =
  { items: readonly TreeBranch[]; ok: true } | { ok: false; reason: 'invalid' | 'stale' };
type Branch = { children: Branch[]; node: ContainerNode };

export function assembleTree(pages: readonly TreePage[], workspaceId: string): TreeResult {
  const parsed = TreePageSchema.array().min(1).max(100).safeParse(pages);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const first = parsed.data[0]!;
  if (parsed.data.some((page) => page.root.id !== workspaceId))
    return { ok: false, reason: 'invalid' };

  if (
    parsed.data.some(
      (page) =>
        page.configVersion !== first.configVersion || page.dataVersion !== first.dataVersion,
    )
  )
    return { ok: false, reason: 'stale' };

  const cursors = parsed.data.flatMap((page) => page.pageInfo.nextCursor ?? []);
  if (
    new Set(cursors).size !== cursors.length ||
    parsed.data.some((page, index) => page.pageInfo.hasNextPage !== index < parsed.data.length - 1)
  )
    return { ok: false, reason: 'invalid' };

  const nodes = parsed.data.flatMap((page) => page.items);
  const branches = new Map<string, Branch>();
  for (const node of nodes) {
    if (node.workspaceId !== workspaceId || node.archivedAt !== null || branches.has(node.id))
      return { ok: false, reason: 'invalid' };

    branches.set(node.id, { node, children: [] });
  }
  const roots: Branch[] = [];
  for (const branch of branches.values()) {
    const parent = branch.node.parentId === null ? null : branches.get(branch.node.parentId);
    if (branch.node.parentId !== null && !parent) return { ok: false, reason: 'invalid' };

    if ((parent?.node.type ?? null) !== ContainerParentType[branch.node.type])
      return { ok: false, reason: 'invalid' };

    if (parent) parent.children.push(branch);
    else roots.push(branch);
  }
  const order = (items: Branch[]) => {
    items.sort(
      (left, right) =>
        left.node.position - right.node.position || left.node.id.localeCompare(right.node.id),
    );
    for (const item of items) order(item.children);
  };
  order(roots);

  return { ok: true, items: roots };
}
