import { NodeTypeSchema } from './enums.js';
import { FieldResolutionInputSchema } from './fields.js';

import type { ValidationIssue } from './errors.js';
import type { FieldDefinition, FieldResolutionInput, FieldResolutionResult } from './fields.js';

const lexical = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const scopeKey = (scope: { ownerId: string; ownerType: string }) =>
  `${scope.ownerType}:${scope.ownerId}`;

export function resolveFields(input: FieldResolutionInput): FieldResolutionResult {
  const parsed = FieldResolutionInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        message: 'Field input does not match its declared schema',
        path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
      })),
    };

  const { scopes, definitions } = parsed.data;
  const root = scopes[0]!;
  if (scopes.some((scope, index) => scope.ownerType !== NodeTypeSchema.options[index]))
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

  const ids = new Set<string>();
  const rows = new Set<string>();
  const issues: ValidationIssue[] = [];
  const relevant = definitions.filter(
    (field) =>
      field.workspaceId === root.ownerId &&
      scopes.some((scope) => scopeKey(scope) === scopeKey(field)),
  );
  for (const field of relevant) {
    const row = `${scopeKey(field)}:${field.key}`;
    if (ids.has(field.id) || rows.has(row))
      issues.push({
        code: 'duplicate_definition',
        message: 'Definition IDs and local keys must be unique',
        path: ['definitions'],
      });

    ids.add(field.id);
    rows.add(row);
  }
  const resolved = new Map<string, FieldDefinition>();
  for (const scope of scopes) {
    const local = relevant.filter((field) => scopeKey(field) === scopeKey(scope));
    if (local.length > 100)
      issues.push({
        code: 'too_many_fields',
        message: 'A scope can define at most 100 fields',
        path: ['definitions', scope.ownerId],
      });

    for (const field of local) resolved.set(field.key, field);
  }
  if (resolved.size > 100)
    issues.push({
      code: 'too_many_fields',
      message: 'A resolved schema can contain at most 100 fields',
      path: ['definitions'],
    });

  if (issues.length > 0) return { success: false, issues };

  const target = scopes.at(-1)!;

  return {
    success: true,
    items: [...resolved.values()]
      .sort((a, b) => a.position - b.position || lexical(a.key, b.key) || lexical(a.id, b.id))
      .map((field) => ({
        ...field,
        source: {
          fieldId: field.id,
          ownerType: field.ownerType,
          ownerId: field.ownerId,
          createdAt: field.createdAt,
          updatedAt: field.updatedAt,
        },
        isInherited: scopeKey(field) !== scopeKey(target),
      })),
  };
}
