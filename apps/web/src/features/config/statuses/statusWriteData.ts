import { ScopeStatusEnvelopeSchema } from '@flowboard/contracts';

import type { StatusScope } from '@flowboard/contracts';
import type { statusCommand } from './statusFormData';

export function readStatusWriteResponse(
  value: unknown,
  expected: {
    command: NonNullable<ReturnType<typeof statusCommand>>;
    owner: StatusScope;
    workspaceId: string | null;
  },
) {
  const parsed = ScopeStatusEnvelopeSchema.safeParse(value);
  if (!parsed.success) return { success: false as const };

  const { command, owner, workspaceId } = expected;
  const { identity, override } = parsed.data.data;
  const expectedId =
    command.kind === 'update'
      ? command.statusId
      : command.body.kind === 'override'
        ? command.body.statusId
        : null;
  const fields = [
    ['name', 'name' in command.body ? command.body.name : undefined],
    ['color', 'color' in command.body ? command.body.color : undefined],
    ['position', 'position' in command.body ? command.body.position : undefined],
    ['hidden', 'hidden' in command.body ? command.body.hidden : undefined],
  ] as const;
  const matches = fields.every(
    ([field, value]) => value === undefined || override[field] === value,
  );
  if (
    !matches ||
    parsed.data.configVersion < command.body.expectedConfigVersion ||
    (command.kind === 'create' &&
      parsed.data.configVersion === command.body.expectedConfigVersion) ||
    identity.workspaceId !== workspaceId ||
    override.workspaceId !== workspaceId ||
    override.ownerId !== owner.ownerId ||
    override.ownerType !== owner.ownerType ||
    override.statusId !== identity.id ||
    (expectedId !== null && identity.id !== expectedId) ||
    (command.kind === 'create' &&
      command.body.kind === 'define' &&
      (identity.key !== command.body.key || identity.category !== command.body.category))
  )
    return { success: false as const };

  return { success: true as const, response: parsed.data };
}
