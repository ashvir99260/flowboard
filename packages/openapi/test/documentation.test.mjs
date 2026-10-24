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
  assert.equal(operations.length, 41);
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
  for (const operation of operations.filter((operation) =>
    ['logIn', 'signUp', 'refreshSession', 'logOut', 'switchWorkspace'].includes(
      operation.operationId,
    ),
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
  assert.deepEqual(document.paths['/v1/auth/switch-workspace'].post.security, [
    { 'access-token': [], 'refresh-cookie': [] },
  ]);
  assert.equal(
    document.components.schemas.SwitchWorkspaceDto.properties.workspaceId.description,
    'Destination workspace where the authenticated account has current membership; may differ from the active workspace.',
  );
  assert.equal(document.components.schemas.LogInDto.properties.password.writeOnly, true);
  assert.ok(!JSON.stringify(document).includes('FlowboardDemo123!'));
});

test('documented success responses retain their concrete DTO schemas', () => {
  const expected = {
    acceptWorkspaceInvitation: 'AcceptedInvitationResponseDto_Output',
    addWorkspaceMember: 'MemberMutationResponseDto_Output',
    createNode: 'NodeResponseDto_Output',
    createScopeField: 'ScopeFieldMutationResponseDto_Output',
    createScopeStatus: 'ScopeStatusMutationResponseDto_Output',
    createTask: 'TaskMutationResponseDto_Output',
    createWorkspaceInvitation: 'InvitationResponseDto_Output',
    getCurrentUser: 'CurrentUserResponseDto_Output',
    getListResolvedFields: 'ResolvedFieldResponseDto_Output',
    getListResolvedStatuses: 'ResolvedStatusResponseDto_Output',
    getLiveness: 'LivenessResponseDto_Output',
    getNode: 'NodeResponseDto_Output',
    getReadiness: 'ReadinessResponseDto_Output',
    getTask: 'TaskResponseDto_Output',
    listNodeGrants: 'GrantPageResponseDto_Output',
    listScopeFields: 'ScopeFieldResponseDto_Output',
    listScopeStatuses: 'ScopeStatusResponseDto_Output',
    listTasks: 'TaskPageResponseDto_Output',
    listVisibleTree: 'TreePageResponseDto_Output',
    listWorkspaceMembers: 'MemberPageResponseDto_Output',
    listWorkspaces: 'WorkspacePageResponseDto_Output',
    logIn: 'SessionResponseDto_Output',
    moveTask: 'TaskMutationResponseDto_Output',
    refreshSession: 'SessionResponseDto_Output',
    reorderNode: 'NodeResponseDto_Output',
    reorderTask: 'TaskMutationResponseDto_Output',
    signUp: 'SessionResponseDto_Output',
    switchWorkspace: 'SessionResponseDto_Output',
    updateNode: 'NodeResponseDto_Output',
    updateScopeField: 'ScopeFieldMutationResponseDto_Output',
    updateScopeStatus: 'ScopeStatusMutationResponseDto_Output',
    updateTask: 'TaskMutationResponseDto_Output',
    updateWorkspaceMember: 'MemberMutationResponseDto_Output',
    upsertNodeGrant: 'GrantResponseDto_Output',
  };
  for (const operation of operations.filter(
    (item) =>
      ![
        'logOut',
        'removeWorkspaceMember',
        'archiveNode',
        'archiveTask',
        'removeNodeGrant',
        'removeScopeStatus',
        'removeScopeField',
      ].includes(item.operationId),
  )) {
    const response =
      operation.responses[
        [
          'signUp',
          'addWorkspaceMember',
          'createWorkspaceInvitation',
          'createNode',
          'createTask',
          'createScopeStatus',
          'createScopeField',
        ].includes(operation.operationId)
          ? '201'
          : '200'
      ];
    const name = expected[operation.operationId];
    assert.equal(response.content['application/json'].schema.$ref, `#/components/schemas/${name}`);
    assert.ok(document.components.schemas[name], `${name} exists`);
  }
});

test('status visibility remains a nullable boolean in every generated request and response', () => {
  const schemas = document.components.schemas;
  const hidden = [
    schemas.CreateScopeStatusDto.oneOf[1].properties.hidden,
    schemas.UpdateScopeStatusDto.properties.hidden,
    schemas.ScopeStatusMutationResponseDto_Output.properties.data.properties.override.properties
      .hidden,
    schemas.ScopeStatusResponseDto_Output.properties.items.items.properties.override.properties
      .hidden,
  ];
  for (const field of hidden) {
    assert.equal(field.type, 'boolean');
    assert.equal(field.nullable, true);
    assert.equal(field.items, undefined);
  }
});

test('published color patterns accept the uppercase colors returned by seeded lists', () => {
  const color = document.components.schemas.CreateScopeStatusDto.oneOf[0].properties.color;
  for (const value of ['#D97706', '#64748B', '#334455']) {
    assert.match(value, new RegExp(color.pattern));
  }
});

test('custom-field patch clearing has typed nullable alternatives', () => {
  const values =
    document.components.schemas.UpdateTaskDto.properties.customFields.additionalProperties;
  assert.equal(values.nullable, undefined);
  assert.deepEqual(
    values.anyOf.map((schema) => schema.type),
    ['string', 'number', 'boolean', 'array'],
  );
  assert.ok(values.anyOf.every((schema) => schema.nullable === true));
});
