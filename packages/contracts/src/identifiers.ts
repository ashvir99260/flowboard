import { z } from 'zod';

export const UuidSchema = z.uuid();
export const UnicodeStringSchema = z.string().refine((value) => {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point === 0 || (point >= 0xd800 && point <= 0xdfff)) return false;
  }
  return true;
}, 'Text contains an unsupported Unicode character');

export function textSchema(maximum: number, minimum = 0, trim = false) {
  return UnicodeStringSchema.overwrite((value) => (trim ? value.trim() : value))
    .refine(
      (value) => Array.from(value).length >= minimum,
      `Must contain at least ${minimum} characters`,
    )
    .refine(
      (value) => Array.from(value).length <= maximum,
      `Must contain at most ${maximum} characters`,
    )
    .meta({ maxLength: maximum, minLength: minimum });
}

export const NameSchema = textSchema(120, 1, true);
export const TitleSchema = textSchema(500, 1, true);
export const EmailSchema = UnicodeStringSchema.overwrite((value) =>
  value.trim().toLowerCase(),
).pipe(z.email().max(254));
export const PasswordSchema = textSchema(128, 12);
export const FieldKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
export const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
export const PositionSchema = z.number().int().min(0).max(2_147_483_647);
export const VersionSchema = PositionSchema.min(1);
