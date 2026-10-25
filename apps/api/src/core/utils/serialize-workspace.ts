import type { IdentityWorkspace } from '@flowboard/database';

export function serializeWorkspace<T extends IdentityWorkspace>(workspace: T) {
  return {
    ...workspace,
    archivedAt: workspace.archivedAt?.toISOString() ?? null,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}
