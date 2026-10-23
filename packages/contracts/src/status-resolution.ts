import { StatusResolutionInputSchema } from './statuses.js';

import type { ValidationIssue } from './errors.js';
import type {
  ResolvedStatus,
  StatusOverride,
  StatusResolutionInput,
  StatusResolutionResult,
  StatusScope,
} from './statuses.js';

const scopeKey = (scope: StatusScope) => `${scope.ownerType}:${scope.ownerId}`;
const requiredCategories = ['not_started', 'active', 'done'] as const;
const scopeOrder = ['workspace', 'space', 'folder', 'list'] as const;
const lexical = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const sourceOf = (row: StatusOverride) => ({
  ownerType: row.ownerType,
  ownerId: row.ownerId,
  overrideId: row.id,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export function resolveStatuses(input: StatusResolutionInput): StatusResolutionResult {
  const parsed = StatusResolutionInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        message: 'Status input does not match its declared schema',
        path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
      })),
    };

  const { scopes, identities, overrides } = parsed.data;
  const root = scopes[0];
  if (!root || scopes.some((scope, index) => scope.ownerType !== scopeOrder[index]))
    return {
      success: false,
      issues: [
        {
          code: 'invalid_scope_path',
          message: 'Expected a workspace-first hierarchy prefix',
          path: ['scopes'],
        },
      ],
    };

  const issues: ValidationIssue[] = [];
  const localIdentities = identities.filter((identity) => identity.workspaceId === root.ownerId);
  const byId = new Map<string, (typeof localIdentities)[number]>();
  const keys = new Set<string>();
  for (const identity of localIdentities) {
    if (byId.has(identity.id) || keys.has(identity.key))
      issues.push({
        code: 'duplicate_identity',
        message: 'Status IDs and keys must be unique in the workspace',
        path: ['identities'],
      });

    byId.set(identity.id, identity);
    keys.add(identity.key);
  }
  const visibleScopes = new Set(scopes.map(scopeKey));
  const rows = overrides
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.workspaceId === root.ownerId && visibleScopes.has(scopeKey(row)));
  const rowKeys = new Set<string>();
  for (const { row, index } of rows) {
    const key = `${scopeKey(row)}:${row.statusId}`;
    if (rowKeys.has(key))
      issues.push({
        code: 'duplicate_override',
        message: 'A scope may configure a status only once',
        path: ['overrides', index],
      });

    rowKeys.add(key);
    if (!byId.has(row.statusId))
      issues.push({
        code: 'unknown_identity',
        message: 'Override references an unknown workspace status',
        path: ['overrides', index, 'statusId'],
      });
  }
  if (issues.length) return { success: false, issues };

  const effective = new Map<string, ResolvedStatus & { hidden: boolean }>();
  for (const [level, scope] of scopes.entries()) {
    const scopeRows = rows.filter(({ row }) => scopeKey(row) === scopeKey(scope));
    if (scopeRows.length > 100)
      issues.push({
        code: 'too_many_statuses',
        message: 'A scope can contain at most 100 status definitions',
        path: ['scopes', level],
      });

    for (const { row, index } of scopeRows) {
      const identity = byId.get(row.statusId);
      if (!identity) continue;

      const previous = effective.get(identity.key);
      const source = sourceOf(row);
      if (!previous) {
        if (row.name === null || row.color === null || row.position === null) {
          for (const field of ['name', 'color', 'position'] as const)
            if (row[field] === null)
              issues.push({
                code: 'incomplete_definition',
                message: 'First introduction requires every display attribute',
                path: ['overrides', index, field],
              });
          continue;
        }

        effective.set(identity.key, {
          ...identity,
          name: row.name,
          color: row.color,
          position: row.position,
          hidden: row.hidden ?? false,
          sourceOwner: scope,
          isInherited: level !== scopes.length - 1,
          isLocal: level === scopes.length - 1,
          isOverridden: false,
          provenance: {
            name: source,
            color: source,
            position: source,
            hidden: row.hidden === null ? null : source,
          },
        });
        continue;
      }

      effective.set(identity.key, {
        ...previous,
        name: row.name ?? previous.name,
        color: row.color ?? previous.color,
        position: row.position ?? previous.position,
        hidden: row.hidden ?? previous.hidden,
        isLocal: previous.isLocal || level === scopes.length - 1,
        isOverridden:
          previous.isOverridden ||
          [row.name, row.color, row.position, row.hidden].some((value) => value !== null),
        provenance: {
          name: row.name === null ? previous.provenance.name : source,
          color: row.color === null ? previous.provenance.color : source,
          position: row.position === null ? previous.provenance.position : source,
          hidden: row.hidden === null ? previous.provenance.hidden : source,
        },
      });
    }
  }
  const items = [...effective.values()]
    .filter((status) => !status.hidden)
    .map(({ hidden: _hidden, ...status }) => status)
    .sort(
      (left, right) =>
        left.position - right.position ||
        lexical(left.key, right.key) ||
        lexical(left.id, right.id),
    );
  for (const category of requiredCategories)
    if (!items.some((status) => status.category === category))
      issues.push({
        code: 'missing_category',
        message: `At least one ${category} status is required`,
        path: ['statuses', category],
      });
  if (items.length > 100)
    issues.push({
      code: 'too_many_statuses',
      message: 'A resolved set can contain at most 100 statuses',
      path: ['statuses'],
    });

  return issues.length ? { success: false, issues } : { success: true, items };
}
