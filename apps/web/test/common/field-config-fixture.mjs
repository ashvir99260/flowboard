import { FieldDefinitionSchema, ScopeFieldCollectionSchema } from '@flowboard/contracts';

export const fieldConfigId = (number) =>
  `70000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

export function fieldConfigurationFixture() {
  const workspaceId = fieldConfigId(1);
  const scopes = ['workspace', 'space', 'folder', 'list'].map((ownerType, index) => ({
    ownerType,
    ownerId: fieldConfigId(index + 1),
  }));
  const definition = (scope, number, key, type = 'number') =>
    FieldDefinitionSchema.parse({
      ...FieldDefinitionSchema.meta().example,
      ...scope,
      workspaceId,
      id: fieldConfigId(number),
      key,
      name: key,
      type,
      required: false,
      options: [],
    });
  const base = definition(scopes[0], 10, 'effort');
  const local = definition(scopes[2], 11, 'area', 'single_select');
  local.options = [
    { id: fieldConfigId(20), label: 'Web', color: '#334455' },
    { id: fieldConfigId(21), label: 'API', color: '#334455' },
  ];
  const collections = scopes.map((scope, index) => ({
    scope,
    data: ScopeFieldCollectionSchema.parse({
      configVersion: 1,
      ancestorScopes: scopes.slice(0, index),
      items: index === 0 ? [base] : index === 2 ? [local] : [],
    }),
  }));

  return { workspaceId, scopes, collections, base, local };
}
