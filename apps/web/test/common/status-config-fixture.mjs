import { ScopeStatusCollectionSchema } from '@flowboard/contracts';

export const statusConfigId = (number) =>
  `60000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

export function statusConfigurationFixture() {
  const workspaceId = statusConfigId(1);
  const scopes = ['workspace', 'space', 'folder', 'list'].map((ownerType, index) => ({
    ownerType,
    ownerId: statusConfigId(index + 1),
  }));
  const audit = { createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z' };
  const rows = ['not_started', 'active', 'done', 'closed'].map((category, index) => ({
    identity: {
      ...audit,
      id: statusConfigId(10 + index),
      key: ['todo', 'active', 'done', 'closed'][index],
      category,
      workspaceId,
    },
    override: {
      ...audit,
      ...scopes[0],
      id: statusConfigId(20 + index),
      statusId: statusConfigId(10 + index),
      workspaceId,
      name: ['To do', 'In progress', 'Done', 'Closed'][index],
      color: '#334455',
      position: index,
      hidden: false,
    },
  }));
  const collections = scopes.map((scope, index) => ({
    scope,
    data: ScopeStatusCollectionSchema.parse({
      configVersion: 1,
      ancestorScopes: scopes.slice(0, index),
      items: index === 0 ? rows : [],
    }),
  }));

  return { workspaceId, scopes, collections, rows };
}
