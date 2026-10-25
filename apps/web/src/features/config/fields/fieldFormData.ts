import {
  CreateScopeFieldSchema,
  CustomFieldOptionSchema,
  resolveFields,
  UpdateScopeFieldSchema,
} from '@flowboard/contracts';
import { z } from 'zod';

import type { CreateScopeField, UpdateScopeField } from '@flowboard/contracts';
import type { readFieldConfiguration } from './fieldConfiguration';

export type FieldConfiguration = Extract<
  ReturnType<typeof readFieldConfiguration>,
  { state: 'ready' }
>;

export type FieldDraft = CreateScopeField;

type FieldCommand =
  | { body: CreateScopeField; kind: 'create' }
  | { body: UpdateScopeField; fieldId: string; kind: 'update' };

export function fieldDefaults(configuration: FieldConfiguration, targetKey?: string): FieldDraft {
  const field = configuration.effective.find((item) => item.key === targetKey);

  return {
    key: field?.key ?? '',
    name: field?.name ?? '',
    type: field?.type ?? 'text',
    required: field?.required ?? false,
    options: structuredClone(field?.options ?? []),
    position: field?.position ?? 0,
    expectedConfigVersion: configuration.configVersion,
  };
}

const optionDraftSchema = CustomFieldOptionSchema.extend({
  color: CustomFieldOptionSchema.shape.color.or(z.literal('')),
}).transform(({ color, ...option }) => (color ? { color, ...option } : option));

export function fieldDraftSchema(targetKey?: string) {
  return CreateScopeFieldSchema.safeExtend({
    options: z.array(optionDraftSchema).max(100),
  }).superRefine((draft, context) => {
    if (targetKey && draft.key !== targetKey)
      context.addIssue({
        code: 'custom',
        path: ['key'],
        message: 'An existing field key cannot change.',
      });
  });
}

export function fieldCommand(
  configuration: FieldConfiguration,
  draft: FieldDraft,
  targetKey?: string,
): FieldCommand | null {
  const normalized = fieldDraftSchema(targetKey).parse({
    ...draft,
    expectedConfigVersion: configuration.configVersion,
  });
  const local = configuration.local.find((item) => item.key === targetKey);
  if (!local) return { kind: 'create', body: normalized };

  const changes = Object.fromEntries(
    Object.entries(normalized).filter(
      ([key, value]) =>
        key !== 'key' &&
        key !== 'expectedConfigVersion' &&
        JSON.stringify(value) !== JSON.stringify(local[key as keyof typeof local]),
    ),
  );
  if (Object.keys(changes).length === 0) return null;

  return {
    kind: 'update',
    fieldId: local.id,
    body: UpdateScopeFieldSchema.parse({
      ...changes,
      expectedConfigVersion: configuration.configVersion,
    }),
  };
}

export function previewFieldEdit(
  configuration: FieldConfiguration,
  draft: unknown,
  targetKey?: string,
) {
  const parsed = fieldDraftSchema(targetKey).safeParse(draft);
  if (!parsed.success)
    return {
      success: false as const,
      issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    };

  const scope = configuration.input.scopes.at(-1)!;
  const local = configuration.local.find((item) => item.key === targetKey);
  const definitions = configuration.input.definitions.filter((item) => item.id !== local?.id);
  const { expectedConfigVersion: _version, ...values } = parsed.data;
  // This identity is only for local previews; the server owns persisted definition IDs.
  const ids = new Set(definitions.map((item) => item.id));
  let number = 1;
  while (ids.has(`00000000-0000-4000-8000-${String(number).padStart(12, '0')}`)) number++;

  return resolveFields({
    scopes: configuration.input.scopes,
    definitions: [
      ...definitions,
      {
        ...values,
        ...scope,
        id: local?.id ?? `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
        workspaceId: configuration.input.scopes[0]!.ownerId,
        createdAt: local?.createdAt ?? '1970-01-01T00:00:00.000Z',
        updatedAt: local?.updatedAt ?? '1970-01-01T00:00:00.000Z',
      },
    ],
  });
}

export function previewFieldRemoval(configuration: FieldConfiguration, targetKey: string) {
  const ownerId = configuration.input.scopes.at(-1)!.ownerId;

  return resolveFields({
    ...configuration.input,
    definitions: configuration.input.definitions.filter(
      (row) => !(row.ownerId === ownerId && row.key === targetKey),
    ),
  });
}
