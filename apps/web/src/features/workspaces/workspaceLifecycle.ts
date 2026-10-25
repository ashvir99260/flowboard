import { UpdateWorkspaceSchema, WorkspaceEnvelopeSchema } from '@flowboard/contracts';

import type { SessionEnvelope, WorkspaceEnvelope } from '@flowboard/contracts';

export const WorkspaceDraftSchema = UpdateWorkspaceSchema.pick({ name: true });

export function archiveStateChanged(before: SessionEnvelope | null, after: SessionEnvelope | null) {
  return before?.data.activeWorkspace?.archivedAt !== after?.data.activeWorkspace?.archivedAt;
}

export function readWorkspaceWrite(
  input: unknown,
  command: {
    expectedConfigVersion: number;
    kind: 'rename' | 'archive' | 'restore';
    workspaceId: string;
  },
): WorkspaceEnvelope | null {
  const parsed = WorkspaceEnvelopeSchema.safeParse(input);
  if (!parsed.success) return null;

  const result = parsed.data;
  if (
    result.data.id !== command.workspaceId ||
    result.configVersion < command.expectedConfigVersion ||
    result.configVersion > command.expectedConfigVersion + 1
  )
    return null;

  if ((command.kind === 'archive') !== (result.data.archivedAt !== null)) return null;

  return result;
}
