import { describe, expect, test } from '@jest/globals';
import { z } from 'zod';

import * as contracts from '../dist/index.js';

describe('shared transport rules', () => {
  test('select options require UUID identities and validated display values', () => {
    expect(
      contracts.CustomFieldOptionSchema.parse({
        color: '#2563EB',
        id: 'f1000000-0000-4000-8000-000000000610',
        label: 'Frontend',
      }).label,
    ).toBe('Frontend');
    expect(
      contracts.CustomFieldOptionSchema.safeParse({
        color: '#2563EB',
        id: 'frontend',
        label: 'Frontend',
      }).success,
    ).toBe(false);
    expect(
      contracts.CustomFieldOptionSchema.safeParse({
        color: 'blue',
        id: 'f1000000-0000-4000-8000-000000000610',
        label: ' ',
      }).success,
    ).toBe(false);
  });
  test('validates domain enums including workspace field ownership', () => {
    expect(contracts.WorkspaceRoleSchema.parse('admin')).toBe('admin');
    expect(contracts.ScopeTypeSchema.parse('workspace')).toBe('workspace');
    expect(contracts.PrioritySchema.safeParse('critical').success).toBe(false);
  });

  test('exports JSON schemas for both request and response strings', () => {
    for (const io of ['input', 'output']) {
      expect(z.toJSONSchema(contracts.NameSchema, { io })).toMatchObject({
        maxLength: 120,
        minLength: 1,
        type: 'string',
      });
      expect(z.toJSONSchema(contracts.TitleSchema, { io })).toMatchObject({
        maxLength: 500,
        type: 'string',
      });
    }
  });

  test('validates real calendar dates without timezone conversion', () => {
    expect(contracts.CalendarDateSchema.parse('2024-02-29')).toBe('2024-02-29');
    for (const date of ['2025-02-29', '2024-04-31', '0000-01-01', '2024-01-01T00:00:00Z']) {
      expect(contracts.CalendarDateSchema.safeParse(date).success).toBe(false);
    }
  });

  test('counts code points and rejects strings PostgreSQL cannot store', () => {
    expect(contracts.NameSchema.parse('  Alice  ')).toBe('Alice');
    expect(contracts.TitleSchema.parse('😀'.repeat(500))).toHaveLength(1000);
    for (const title of ['', '  ', 'a'.repeat(501), 'x\0y', '\ud800', '\udc00']) {
      expect(contracts.TitleSchema.safeParse(title).success).toBe(false);
    }
  });

  test('accepts cursor-only query parameters and strict limits', () => {
    expect(contracts.PaginationQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(contracts.PaginationQuerySchema.parse({ cursor: 'abc', limit: '100' })).toEqual({
      cursor: 'abc',
      limit: 100,
    });
    for (const input of [
      { page: '1' },
      { offset: '0' },
      { take: '5' },
      { limit: '' },
      { limit: '1.5' },
      { limit: '101' },
      { limit: ['5', '10'] },
      { cursor: '' },
    ]) {
      expect(contracts.PaginationQuerySchema.safeParse(input).success).toBe(false);
    }
  });

  test('rejects duplicate query keys before object conversion', () => {
    expect(() =>
      contracts.parseQueryEntries([
        ['limit', '1'],
        ['limit', '2'],
      ]),
    ).toThrow();
    expect(contracts.parseQueryEntries([['limit', '2']])).toEqual({ limit: 2 });
  });

  test('keeps pagination envelope and issue paths consistent', () => {
    const schema = contracts.cursorPageSchema(contracts.UuidSchema);
    expect(
      schema.safeParse({ items: [], pageInfo: { hasNextPage: true, nextCursor: null } }).success,
    ).toBe(false);
    expect(
      schema.parse({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } }).items,
    ).toEqual([]);
    expect(
      contracts.ErrorEnvelopeSchema.parse({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid value',
          details: [{ path: ['customFields', 'effort'], code: 'required', message: 'Required' }],
        },
      }).error.details[0].path,
    ).toEqual(['customFields', 'effort']);
    expect(
      contracts.ErrorEnvelopeSchema.safeParse({ error: { code: 'unknown', message: 'bad' } })
        .success,
    ).toBe(false);
  });
});
