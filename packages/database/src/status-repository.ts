import {
  CreateScopeStatusSchema,
  ExpectedConfigSchema,
  resolveStatuses,
  resolveVisibleTree,
  StatusScopeSchema,
  UpdateScopeStatusSchema,
  UuidSchema,
} from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';
import { recordWorkspaceChange } from './workspace-events.js';

import type { Prisma } from './generated/client.js';
import type { NodeRecord } from './repositories.js';
import type { TenantContext } from './tenant-context.js';
import type {
  CreateScopeStatus,
  StatusIdentity,
  StatusOverride,
  StatusScope,
  UpdateScopeStatus,
} from '@flowboard/contracts';

export function statusRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
  nodePath: (id: string) => Promise<NodeRecord[] | null>,
) {
  const { workspaceId, actorUserId } = context;
  async function path(input: StatusScope): Promise<StatusScope[]> {
    assertActive();
    const owner = StatusScopeSchema.parse(input);
    const root = { ownerType: 'workspace' as const, ownerId: workspaceId };
    if (owner.ownerType === 'workspace') {
      if (owner.ownerId !== workspaceId) throw new DatabaseError('NOT_FOUND', 'Scope not found');

      return [root];
    }

    const nodes = await nodePath(owner.ownerId);
    if (!nodes || nodes.at(-1)?.type !== owner.ownerType)
      throw new DatabaseError('NOT_FOUND', 'Scope not found');

    return [root, ...nodes.map((node) => ({ ownerType: node.type, ownerId: node.id }))];
  }
  async function configuration() {
    return tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true },
    });
  }
  async function rows(scopes: StatusScope[]) {
    const overrides = await tx.statusOverride.findMany({
      where: { workspaceId, OR: scopes },
      orderBy: { id: 'asc' },
    });
    const identities = await tx.statusIdentity.findMany({
      where: { workspaceId, id: { in: overrides.map((row) => row.statusId) } },
      orderBy: { key: 'asc' },
    });

    return {
      identities: identities.map((row): StatusIdentity => ({
        id: row.id,
        workspaceId: row.workspaceId,
        key: row.key,
        category: row.category,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      overrides: overrides.map((row): StatusOverride => ({
        id: row.id,
        workspaceId: row.workspaceId,
        statusId: row.statusId,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        name: row.name,
        color: row.color,
        position: row.position,
        hidden: row.hidden,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
  const read = Object.freeze({
    path,
    async local(owner: StatusScope) {
      const scopes = await path(owner);
      const data = await rows([scopes.at(-1)!]);
      const items = data.identities.flatMap((identity) =>
        data.overrides
          .filter((row) => row.statusId === identity.id)
          .map((override) => ({ identity, override })),
      );

      return { items, ancestorScopes: scopes.slice(0, -1), ...(await configuration()) };
    },
    async resolved(listId: string) {
      const scopes = await path({ ownerType: 'list', ownerId: listId });
      const result = resolveStatuses({ scopes, ...(await rows(scopes)) });
      if (!result.success)
        throw new DatabaseError('CONFIG_INVALIDATES_TASKS', 'Status configuration is invalid');

      return { items: result.items, ...(await configuration()) };
    },
  });

  async function checkVersion(expected: number) {
    const current = await configuration();
    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current;
  }
  async function validate(owner: StatusScope) {
    const nodes = await tx.node.findMany({ where: { workspaceId, archivedAt: null } });
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const root: StatusScope = { ownerType: 'workspace', ownerId: workspaceId };
    const paths = [
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
    const allScopes = [
      ...new Map(
        paths.flat().map((scope) => [`${scope.ownerType}:${scope.ownerId}`, scope]),
      ).values(),
    ];
    const data = await rows(allScopes);
    const listStatuses = new Map<string, Set<string>>();
    for (const scopes of paths) {
      const result = resolveStatuses({ scopes, ...data });
      const target = scopes.at(-1)!;
      if (!result.success)
        throw new DatabaseError(
          'CONFIG_INVALIDATES_TASKS',
          'Status change invalidates an affected scope',
          result.issues.map((issue) => ({
            ...issue,
            path: ['scopes', target.ownerId, ...issue.path],
          })),
        );

      if (target.ownerType === 'list')
        listStatuses.set(target.ownerId, new Set(result.items.map((item) => item.id)));
    }
    const tasks = await tx.task.findMany({
      where: { workspaceId, archivedAt: null, primaryListId: { in: [...listStatuses.keys()] } },
      select: { primaryListId: true, statusId: true },
    });
    if (tasks.some((task) => !listStatuses.get(task.primaryListId)!.has(task.statusId)))
      throw new DatabaseError(
        'STATUS_IN_USE',
        'Status change would hide a status used by a live task',
        [
          {
            code: 'status_in_use',
            path: ['statusId'],
            message: 'An affected list still has a live task using this status',
          },
        ],
      );
  }
  async function target(owner: StatusScope, id: string) {
    await path(owner);
    const row = await tx.statusOverride.findFirst({
      where: { workspaceId, ...owner, statusId: UuidSchema.parse(id).toLowerCase() },
    });
    if (!row) throw new DatabaseError('NOT_FOUND', 'Local status configuration not found');

    return row;
  }
  async function result(owner: StatusScope, id: string, configVersion: number) {
    const local = await read.local(owner);
    const data = local.items.find((item) => item.identity.id === id);
    if (!data)
      throw new DatabaseError('INTERNAL_ERROR', 'Status write did not produce a local row');

    return { data, configVersion };
  }
  const write = Object.freeze({
    ...read,
    async create(ownerInput: StatusScope, input: CreateScopeStatus) {
      const owner = StatusScopeSchema.parse(ownerInput);
      const scopes = await path(owner);
      const parsed = CreateScopeStatusSchema.parse(input);
      await checkVersion(parsed.expectedConfigVersion);
      let statusId: string;
      if (parsed.kind === 'define') {
        const existing = await tx.statusIdentity.findUnique({
          where: { workspaceId_key: { workspaceId, key: parsed.key } },
        });
        if (existing && existing.category !== parsed.category)
          throw new DatabaseError('CONFIG_CONFLICT', 'Status key already has a different category');

        const identity =
          existing ??
          (await tx.statusIdentity.create({
            data: { workspaceId, key: parsed.key, category: parsed.category },
          }));
        statusId = identity.id;
      } else {
        statusId = parsed.statusId;
        const ancestors = scopes.slice(0, -1);
        if (
          ancestors.length === 0 ||
          !(await tx.statusOverride.findFirst({ where: { workspaceId, statusId, OR: ancestors } }))
        )
          throw new DatabaseError('NOT_FOUND', 'Inherited status not found');
      }

      if (await tx.statusOverride.findFirst({ where: { workspaceId, ...owner, statusId } }))
        throw new DatabaseError('CONFIG_CONFLICT', 'Local status configuration already exists');

      await tx.statusOverride.create({
        data: {
          workspaceId,
          ...owner,
          statusId,
          name: parsed.name ?? null,
          color: parsed.color ?? null,
          position: parsed.position ?? null,
          hidden: parsed.kind === 'override' ? (parsed.hidden ?? null) : null,
        },
      });
      await validate(owner);
      const { configVersion } = await recordWorkspaceChange(tx, workspaceId, actorUserId, 'status');

      return result(owner, statusId, configVersion);
    },
    async update(ownerInput: StatusScope, id: string, input: UpdateScopeStatus) {
      const owner = StatusScopeSchema.parse(ownerInput);
      const existing = await target(owner, id);
      const parsed = UpdateScopeStatusSchema.parse(input);
      const current = await checkVersion(parsed.expectedConfigVersion);
      const changes = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key !== 'expectedConfigVersion'),
      );
      if (
        Object.entries(changes).every(
          ([key, value]) => existing[key as 'name' | 'color' | 'position' | 'hidden'] === value,
        )
      )
        return result(owner, existing.statusId, current.configVersion);

      await tx.statusOverride.update({
        where: { workspaceId_id: { workspaceId, id: existing.id } },
        data: changes,
      });
      await validate(owner);
      const { configVersion } = await recordWorkspaceChange(tx, workspaceId, actorUserId, 'status');

      return result(owner, existing.statusId, configVersion);
    },
    async remove(ownerInput: StatusScope, id: string, input: { expectedConfigVersion: number }) {
      const owner = StatusScopeSchema.parse(ownerInput);
      const existing = await target(owner, id);
      const parsed = ExpectedConfigSchema.parse(input);
      await checkVersion(parsed.expectedConfigVersion);
      await tx.statusOverride.delete({
        where: { workspaceId_id: { workspaceId, id: existing.id } },
      });
      await validate(owner);
      await recordWorkspaceChange(tx, workspaceId, actorUserId, 'status');
    },
  });

  return { read, write };
}
