import { SilentLogger } from '@flowboard/logger';
import { expect, test } from '@jest/globals';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';

import { HttpExceptionFilter } from '../../../dist/core/common/filters/http-exception.filter.js';

test('unknown request fields keep complete nested paths without echoing their values', () => {
  const result = z
    .strictObject({ nested: z.strictObject({ known: z.string() }) })
    .safeParse({ extra: 'sensitive-value', nested: { known: 'ok', unexpected: 'another-secret' } });
  let status, body;
  const response = {
    status: (code) => {
      status = code;

      return response;
    },
    json: (value) => {
      body = value;
    },
  };
  new HttpExceptionFilter(SilentLogger).catch(new ZodValidationException(result.error), {
    switchToHttp: () => ({ getResponse: () => response }),
  });
  expect(status).toBe(400);
  expect(body.error.details.map((issue) => issue.path)).toEqual([
    ['nested', 'unexpected'],
    ['extra'],
  ]);
  expect(JSON.stringify(body)).not.toContain('sensitive-value');
  expect(JSON.stringify(body)).not.toContain('another-secret');
});
