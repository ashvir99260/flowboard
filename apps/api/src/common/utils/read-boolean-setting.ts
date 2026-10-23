export function readBooleanSetting(value: string | undefined, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (value && value !== 'true' && value !== 'false')
    throw new Error(`${name} must be true or false`);
  return value === 'true';
}
