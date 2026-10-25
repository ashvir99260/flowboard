import { FieldScopeSchema, resolveFields, ScopeFieldCollectionSchema } from '@flowboard/contracts';

import type { FieldDefinition, FieldScope } from '@flowboard/contracts';

const key = (scope: FieldScope) => `${scope.ownerType}:${scope.ownerId}`;

export function readFieldConfiguration(input: {
  collections: readonly { data: unknown; scope: FieldScope }[];
  scope: FieldScope;
  workspaceId: string;
}) {
  const invalid = { state: 'invalid' as const };
  if (!FieldScopeSchema.safeParse(input.scope).success) return invalid;

  const selected = input.collections.find((entry) => key(entry.scope) === key(input.scope));
  if (!selected || selected.data === undefined) return { state: 'pending' as const };

  const parsed = ScopeFieldCollectionSchema.safeParse(selected.data);
  if (!parsed.success) return invalid;

  const scopes = [...parsed.data.ancestorScopes, input.scope];
  if (
    scopes[0]?.ownerId !== input.workspaceId ||
    scopes.some(
      (scope, index) => scope.ownerType !== ['workspace', 'space', 'folder', 'list'][index],
    ) ||
    new Set(scopes.map((scope) => scope.ownerId)).size !== scopes.length
  )
    return invalid;

  const collectionKeys = input.collections.map((entry) => key(entry.scope));
  if (
    new Set(collectionKeys).size !== collectionKeys.length ||
    collectionKeys.some((value) => !scopes.some((scope) => key(scope) === value))
  )
    return invalid;

  const definitions: FieldDefinition[] = [];
  for (const [index, scope] of scopes.entries()) {
    const entry = input.collections.find((candidate) => key(candidate.scope) === key(scope));
    if (!entry || entry.data === undefined) return { state: 'pending' as const };

    const result = ScopeFieldCollectionSchema.safeParse(entry.data);
    if (
      !result.success ||
      result.data.ancestorScopes.length !== index ||
      result.data.ancestorScopes.some((ancestor, i) => key(ancestor) !== key(scopes[i]!))
    )
      return invalid;

    if (result.data.configVersion !== parsed.data.configVersion) return { state: 'stale' as const };

    for (const definition of result.data.items) {
      if (definition.workspaceId !== input.workspaceId || key(definition) !== key(scope))
        return invalid;

      definitions.push(definition);
    }
  }
  const resolutionInput = { scopes, definitions };
  const resolution = resolveFields(resolutionInput);
  if (!resolution.success) return invalid;

  return {
    state: 'ready' as const,
    configVersion: parsed.data.configVersion,
    input: resolutionInput,
    effective: resolution.items,
    local: parsed.data.items,
  };
}
