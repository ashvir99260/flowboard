import { ScopeFieldEnvelopeSchema } from '@flowboard/contracts';

import type { fieldCommand } from './field-form-data';
import type { FieldScope } from '@flowboard/contracts';

export function readFieldWriteResponse(
  value: unknown,
  expected: {
    command: NonNullable<ReturnType<typeof fieldCommand>>;
    owner: FieldScope;
    workspaceId: string | null;
  },
) {
  const parsed = ScopeFieldEnvelopeSchema.safeParse(value);
  if (!parsed.success) return { success: false as const };

  const { command, owner, workspaceId } = expected;
  const row = parsed.data.data;
  const matches = Object.entries(command.body).every(
    ([key, value]) =>
      key === 'expectedConfigVersion' ||
      JSON.stringify(row[key as keyof typeof row]) === JSON.stringify(value),
  );
  if (
    !matches ||
    row.workspaceId !== workspaceId ||
    row.ownerId !== owner.ownerId ||
    row.ownerType !== owner.ownerType ||
    parsed.data.configVersion < command.body.expectedConfigVersion ||
    (command.kind === 'update' && row.id !== command.fieldId) ||
    (command.kind === 'create' && parsed.data.configVersion === command.body.expectedConfigVersion)
  )
    return { success: false as const };

  return { success: true as const, response: parsed.data };
}
