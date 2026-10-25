import {
  GrantEnvelopeSchema,
  GrantPageSchema,
  MemberPageSchema,
  NodeEnvelopeSchema,
  NodeSchema,
  TreePageSchema,
  UpdateNodeSchema,
} from '@flowboard/contracts';
import { z } from 'zod';

import { assembleTree } from '../tree/assembleTree.ts';

import type { Grant, Member, NodeEnvelope } from '@flowboard/contracts';

export type Container = z.infer<typeof NodeSchema>;

export type AdministrationSnapshot = {
  configVersion: number;
  dataVersion: number;
  grants: Grant[];
  members: Member[];
  nodes: Container[];
};

type Page<T> = {
  configVersion: number;
  items: T[];
  pageInfo: { hasNextPage: boolean; nextCursor: string | null };
};

function readPages<T>(
  input: readonly unknown[] | undefined,
  parse: (value: unknown) => { data: Page<T>; success: true } | { success: false },
) {
  if (!input?.length) return { state: 'pending' as const };

  const items: T[] = [];
  const cursors = new Set<string>();
  let version: number | undefined;
  for (const [index, value] of input.entries()) {
    const parsed = parse(value);
    if (!parsed.success) return { state: 'invalid' as const };

    const page = parsed.data;
    if (version !== undefined && version !== page.configVersion) return { state: 'stale' as const };

    version = page.configVersion;
    items.push(...page.items);
    if (page.pageInfo.nextCursor) {
      if (cursors.has(page.pageInfo.nextCursor)) return { state: 'invalid' as const };

      cursors.add(page.pageInfo.nextCursor);
    } else if (index !== input.length - 1) return { state: 'invalid' as const };

    if (index === input.length - 1 && page.pageInfo.hasNextPage)
      return { state: 'pending' as const };
  }

  return { configVersion: version!, items, state: 'ready' as const };
}

export function readAdministration(input: {
  grantPages?: readonly unknown[];
  memberPages?: readonly unknown[];
  nodeId?: string;
  treePages?: readonly unknown[];
  workspaceId: string;
}) {
  const tree = readPages(input.treePages, TreePageSchema.safeParse);
  const members = readPages(input.memberPages, MemberPageSchema.safeParse);
  const grants = input.nodeId
    ? readPages(input.grantPages, GrantPageSchema.safeParse)
    : {
        configVersion: tree.state === 'ready' ? tree.configVersion : 0,
        items: [],
        state: 'ready' as const,
      };
  if ([tree.state, members.state, grants.state].includes('invalid'))
    return { state: 'invalid' as const };

  if ([tree.state, members.state, grants.state].includes('stale'))
    return { state: 'stale' as const };

  if (tree.state !== 'ready' || members.state !== 'ready' || grants.state !== 'ready')
    return { state: 'pending' as const };

  if (tree.configVersion !== members.configVersion || tree.configVersion !== grants.configVersion)
    return { state: 'stale' as const };

  const parsedTree = TreePageSchema.array().safeParse(input.treePages);
  if (!parsedTree.success || !assembleTree(parsedTree.data, input.workspaceId).ok)
    return { state: 'invalid' as const };

  const memberIds = new Set(members.items.map((member) => member.userId));
  if (
    memberIds.size !== members.items.length ||
    new Set(grants.items.map((grant) => grant.userId)).size !== grants.items.length ||
    grants.items.some(
      (grant) => grant.resourceId !== input.nodeId || !memberIds.has(grant.userId),
    ) ||
    (input.nodeId && !tree.items.some((node) => node.id === input.nodeId))
  )
    return { state: 'invalid' as const };

  return {
    state: 'ready' as const,
    snapshot: {
      configVersion: tree.configVersion,
      dataVersion: parsedTree.data[0]!.dataVersion,
      grants: grants.items,
      members: members.items,
      nodes: tree.items,
    } satisfies AdministrationSnapshot,
  };
}

export const ContainerEditSchema = NodeSchema.pick({ name: true, visibility: true });

export function containerLabel(node: Container, nodes: readonly Container[]): string {
  const names = [node.name];
  let parent = node.parentId;
  for (let depth = 0; parent && depth < 3; depth++) {
    const ancestor = nodes.find((item) => item.id === parent);
    if (!ancestor) break;

    names.unshift(ancestor.name);
    parent = ancestor.parentId;
  }

  return `${node.type}: ${names.join(' / ')}`;
}

export function updateContainerInput(
  node: Container,
  draft: z.infer<typeof ContainerEditSchema>,
  configVersion: number,
) {
  const parsed = ContainerEditSchema.parse(draft);
  const changes = {
    ...(parsed.name !== node.name ? { name: parsed.name } : {}),
    ...(parsed.visibility !== node.visibility ? { visibility: parsed.visibility } : {}),
  };
  if (!Object.keys(changes).length) return null;

  return UpdateNodeSchema.parse({
    ...changes,
    expectedVersion: node.version,
    expectedConfigVersion: configVersion,
  });
}

export function readContainerWrite(
  value: unknown,
  expected: { nodeId?: string; workspaceId: string },
): NodeEnvelope | null {
  const parsed = NodeEnvelopeSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.data.workspaceId !== expected.workspaceId ||
    parsed.data.data.archivedAt !== null ||
    (expected.nodeId && parsed.data.data.id !== expected.nodeId)
  )
    return null;

  return parsed.data;
}

export function readGrantWrite(
  value: unknown,
  expected: { configVersion: number; mode: 'allow' | 'deny'; nodeId: string; userId: string },
) {
  const parsed = GrantEnvelopeSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.data.resourceId !== expected.nodeId ||
    parsed.data.data.userId !== expected.userId ||
    parsed.data.data.mode !== expected.mode ||
    parsed.data.configVersion < expected.configVersion ||
    parsed.data.configVersion > expected.configVersion + 1
  )
    return null;

  return parsed.data;
}
