import {
  CreateScopeFieldSchema,
  ExpectedConfigSchema,
  FieldDefinitionSchema,
  FieldScopeSchema,
  resolveFields,
  UpdateScopeFieldSchema,
  UuidSchema,
  validateTaskFields,
} from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';
import { recordWorkspaceChange } from './workspace-events.js';

import type { Prisma } from './generated/client.js';
import type { scopeRepository } from './scope-repository.js';
import type { TenantContext } from './tenant-context.js';
import type {
  CreateScopeField,
  FieldScope,
  ResolvedField,
  UpdateScopeField,
} from '@flowboard/contracts';

export function fieldRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  scopes: ReturnType<typeof scopeRepository>,
) {
  const { workspaceId } = context;
  async function configuration() {
    return tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true },
    });
  }
  async function rows(owners: FieldScope[]) {
    const definitions = await tx.fieldDefinition.findMany({
      where: { workspaceId, OR: owners },
      orderBy: [{ position: 'asc' }, { key: 'asc' }, { id: 'asc' }],
    });

    return definitions.map((row) => {
      const parsed = FieldDefinitionSchema.safeParse({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
      if (!parsed.success)
        throw new DatabaseError('CONFIG_INVALIDATES_TASKS', 'Field configuration is invalid');

      return parsed.data;
    });
  }
  const read = Object.freeze({
    async local(owner: FieldScope) {
      const path = await scopes.path(owner);
      const items = await rows([path.at(-1)!]);
      if (items.length > 100)
        throw new DatabaseError(
          'CONFIG_INVALIDATES_TASKS',
          'Field configuration exceeds its limit',
        );

      return { items, ancestorScopes: path.slice(0, -1), ...(await configuration()) };
    },
    async resolved(listId: string) {
      const path = await scopes.path({ ownerType: 'list', ownerId: listId });
      const result = resolveFields({ scopes: path, definitions: await rows(path) });
      if (!result.success)
        throw new DatabaseError('CONFIG_INVALIDATES_TASKS', 'Field configuration is invalid');

      return { items: result.items, ...(await configuration()) };
    },
  });
  async function checkVersion(expected: number) {
    const current = await configuration();
    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current;
  }
  async function target(owner: FieldScope, id: string) {
    await scopes.path(owner);
    const items = await rows([owner]);
    const row = items.find((item) => item.id === UuidSchema.parse(id).toLowerCase());
    if (!row) throw new DatabaseError('NOT_FOUND', 'Local field definition not found');

    return row;
  }
  async function validate(owner: FieldScope, removing: boolean) {
    const paths = await scopes.affectedPaths(owner);
    const allScopes = [
      ...new Map(
        paths.flat().map((scope) => [`${scope.ownerType}:${scope.ownerId}`, scope]),
      ).values(),
    ];
    const definitions = await rows(allScopes);
    const listFields = new Map<string, ResolvedField[]>();
    for (const path of paths) {
      const resolved = resolveFields({ scopes: path, definitions });
      const affected = path.at(-1)!;
      if (!resolved.success)
        throw new DatabaseError(
          'CONFIG_INVALIDATES_TASKS',
          'Field change invalidates an affected scope',
          resolved.issues.map((issue) => ({
            ...issue,
            path: ['scopes', affected.ownerId, ...issue.path],
          })),
        );

      if (affected.ownerType === 'list') listFields.set(affected.ownerId, resolved.items);
    }
    const tasks = await tx.task.findMany({
      where: { workspaceId, archivedAt: null, primaryListId: { in: [...listFields.keys()] } },
      select: { customFields: true, primaryListId: true },
    });
    for (const task of tasks) {
      const issues = validateTaskFields({
        fields: listFields.get(task.primaryListId)!,
        values: task.customFields,
      });
      if (issues.length > 0)
        throw new DatabaseError(
          removing && issues.some((issue) => issue.code === 'unknown_field')
            ? 'FIELD_IN_USE'
            : 'CONFIG_INVALIDATES_TASKS',
          'Field change would invalidate a live task',
          issues.slice(0, 25),
        );
    }
  }
  async function result(owner: FieldScope, id: string, configVersion: number) {
    return { data: await target(owner, id), configVersion };
  }
  const write = Object.freeze({
    ...read,
    async create(ownerInput: FieldScope, input: CreateScopeField) {
      const owner = FieldScopeSchema.parse(ownerInput);
      await scopes.path(owner);
      const { expectedConfigVersion, ...data } = CreateScopeFieldSchema.parse(input);
      await checkVersion(expectedConfigVersion);
      const existing = await tx.fieldDefinition.findFirst({
        where: { workspaceId, ...owner, key: data.key },
      });
      if (existing) throw new DatabaseError('CONFIG_CONFLICT', 'Local field key already exists');

      const row = await tx.fieldDefinition.create({ data: { ...data, ...owner, workspaceId } });
      await validate(owner, false);
      const { configVersion } = await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'field',
      );

      return result(owner, row.id, configVersion);
    },
    async update(ownerInput: FieldScope, id: string, input: UpdateScopeField) {
      const owner = FieldScopeSchema.parse(ownerInput);
      const existing = await target(owner, id);
      const { expectedConfigVersion, ...changes } = UpdateScopeFieldSchema.parse(input);
      const current = await checkVersion(expectedConfigVersion);
      const candidate = FieldDefinitionSchema.safeParse({ ...existing, ...changes });
      if (!candidate.success)
        throw new DatabaseError(
          'VALIDATION_FAILED',
          'Field definition is invalid',
          candidate.error.issues.map((issue) => ({
            code: issue.code,
            message: 'Field definition does not match its declared schema',
            path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
          })),
        );

      const { name, type, required, options, position } = candidate.data;
      const data = { name, type, required, options, position };
      if (
        Object.entries(data).every(
          ([key, value]) =>
            JSON.stringify(value) === JSON.stringify(existing[key as keyof typeof data]),
        )
      )
        return result(owner, existing.id, current.configVersion);

      await tx.fieldDefinition.update({
        where: { workspaceId_id: { workspaceId, id: existing.id } },
        data,
      });
      await validate(owner, false);
      const { configVersion } = await recordWorkspaceChange(
        tx,
        workspaceId,
        context.actorUserId,
        'field',
      );

      return result(owner, existing.id, configVersion);
    },
    async remove(ownerInput: FieldScope, id: string, input: { expectedConfigVersion: number }) {
      const owner = FieldScopeSchema.parse(ownerInput);
      const existing = await target(owner, id);
      await checkVersion(ExpectedConfigSchema.parse(input).expectedConfigVersion);
      await tx.fieldDefinition.delete({
        where: { workspaceId_id: { workspaceId, id: existing.id } },
      });
      await validate(owner, true);
      await recordWorkspaceChange(tx, workspaceId, context.actorUserId, 'field');
    },
  });

  return { read, write, validate };
}
