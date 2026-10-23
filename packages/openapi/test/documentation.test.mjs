import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const document = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
const operations = Object.values(document.paths).flatMap((path) =>
  Object.entries(path)
    .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
    .map(([, operation]) => operation),
);
const meaningful = (value, label) =>
  assert.ok(typeof value === 'string' && value.trim().length > 0, label);
const hasExample = (schema) =>
  Object.hasOwn(schema, 'example') || Object.hasOwn(schema, 'examples');

test('every Swagger operation and payload has a description and example', () => {
  assert.equal(operations.length, 6);
  for (const operation of operations) {
    meaningful(operation.summary, `${operation.operationId} summary`);
    meaningful(operation.description, `${operation.operationId} description`);
    for (const [status, response] of Object.entries(operation.responses)) {
      meaningful(response.description, `${operation.operationId} ${status} description`);
      if (status === '204') {
        assert.equal(response.content, undefined);
        continue;
      }
      const media = response.content?.['application/json'];
      assert.ok(media && hasExample(media), `${operation.operationId} ${status} response example`);
    }
    if (operation.requestBody) {
      meaningful(operation.requestBody.description, `${operation.operationId} body description`);
      assert.ok(
        hasExample(operation.requestBody.content['application/json']),
        `${operation.operationId} request example`,
      );
    }
  }
});

test('schema fields carry titles, descriptions and examples, including nullable fields', () => {
  const visit = (schema, path) => {
    if (!schema || typeof schema !== 'object') return;
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      meaningful(value.title, `${path}.${key} title`);
      meaningful(value.description, `${path}.${key} description`);
      assert.ok(hasExample(value), `${path}.${key} example`);
      visit(value, `${path}.${key}`);
    }
    for (const variant of [
      ...(schema.allOf ?? []),
      ...(schema.anyOf ?? []),
      ...(schema.oneOf ?? []),
    ])
      visit(variant, path);
    if (schema.items) visit(schema.items, `${path}[]`);
  };
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    meaningful(schema.title, `${name} title`);
    meaningful(schema.description, `${name} description`);
    assert.ok(hasExample(schema), `${name} example`);
    visit(schema, name);
  }
});

test('auth headers and security document cookie use without inventing a logout body', () => {
  for (const operation of operations.filter(
    (operation) => !operation.operationId.startsWith('get'),
  )) {
    const origin = operation.parameters.find(
      (parameter) => parameter.in === 'header' && parameter.name === 'Origin',
    );
    assert.equal(origin.required, true);
    meaningful(origin.description, `${operation.operationId} Origin description`);
    assert.ok(hasExample(origin.schema));
    assert.equal(operation.responses['429'].headers['Retry-After'].schema.example, 60);
  }
  const logout = document.paths['/v1/auth/logout'].post;
  assert.deepEqual(logout.security, [{ 'refresh-cookie': [] }]);
  assert.ok(logout.responses['204'].headers['Set-Cookie'].example.includes('Max-Age=0'));
  assert.equal(logout.responses['204'].content, undefined);
  assert.equal(document.components.schemas.LogInDto.properties.password.writeOnly, true);
  assert.ok(!JSON.stringify(document).includes('FlowboardDemo123!'));
});

test('documented success responses retain their concrete DTO schemas', () => {
  const expected = {
    getLiveness: 'LivenessResponseDto_Output',
    getReadiness: 'ReadinessResponseDto_Output',
    logIn: 'SessionResponseDto_Output',
    refreshSession: 'SessionResponseDto_Output',
    signUp: 'SessionResponseDto_Output',
  };
  for (const operation of operations.filter((item) => item.operationId !== 'logOut')) {
    const response = operation.responses[operation.operationId === 'signUp' ? '201' : '200'];
    const name = expected[operation.operationId];
    assert.equal(response.content['application/json'].schema.$ref, `#/components/schemas/${name}`);
    assert.ok(document.components.schemas[name], `${name} exists`);
  }
});
