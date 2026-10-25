import {
  resolveStatuses,
  ScopeStatusCollectionSchema,
  StatusScopeSchema,
} from '@flowboard/contracts';

import type {
  ScopeStatusCollection,
  StatusIdentity,
  StatusOverride,
  StatusScope,
} from '@flowboard/contracts';

const key = (scope: StatusScope) => `${scope.ownerType}:${scope.ownerId}`;
const samePath = (left: readonly StatusScope[], right: readonly StatusScope[]) =>
  left.length === right.length && left.every((scope, index) => key(scope) === key(right[index]!));

export function readStatusConfiguration(input: {
  collections: readonly { data: unknown; scope: StatusScope }[];
  scope: StatusScope;
  workspaceId: string;
}) {
  const invalid = { state: 'invalid' as const };
  if (!StatusScopeSchema.safeParse(input.scope).success) return invalid;

  const selected = input.collections.find((entry) => key(entry.scope) === key(input.scope));
  if (!selected || selected.data === undefined) return { state: 'pending' as const };

  const parsed = ScopeStatusCollectionSchema.safeParse(selected.data);
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

  const identities = new Map<string, StatusIdentity>();
  const overrides: StatusOverride[] = [];
  const collections: ScopeStatusCollection[] = [];
  for (const [index, scope] of scopes.entries()) {
    const entry = input.collections.find((candidate) => key(candidate.scope) === key(scope));
    if (!entry || entry.data === undefined) return { state: 'pending' as const };

    const result = ScopeStatusCollectionSchema.safeParse(entry.data);
    if (!result.success || !samePath(result.data.ancestorScopes, scopes.slice(0, index)))
      return invalid;

    if (result.data.configVersion !== parsed.data.configVersion) return { state: 'stale' as const };

    for (const { identity, override } of result.data.items) {
      if (
        identity.workspaceId !== input.workspaceId ||
        override.workspaceId !== input.workspaceId ||
        key(override) !== key(scope) ||
        override.statusId !== identity.id
      )
        return invalid;

      const previous = identities.get(identity.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(identity)) return invalid;

      identities.set(identity.id, identity);
      overrides.push(override);
    }
    collections.push(result.data);
  }
  if (new Set(overrides.map((row) => row.id)).size !== overrides.length) return invalid;

  const resolutionInput = { scopes, identities: [...identities.values()], overrides };
  const resolution = resolveStatuses(resolutionInput);
  if (!resolution.success) return invalid;

  return {
    state: 'ready' as const,
    configVersion: parsed.data.configVersion,
    input: resolutionInput,
    effective: resolution.items,
    local: collections.at(-1)!.items,
  };
}
