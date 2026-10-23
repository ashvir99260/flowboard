import { randomUUID } from 'node:crypto';

// Identifiers come only from the fixed fixture declarations in this test file.
export async function insert(client, table, values) {
  const entries = Object.entries(values);
  const columns = entries.map(([key]) => `"${key}"`).join(', ');
  const parameters = entries.map((_, index) => `$${index + 1}`).join(', ');
  const { rows } = await client.query(
    `INSERT INTO "${table}" (${columns}) VALUES (${parameters}) RETURNING *`,
    entries.map(([, value]) => value),
  );

  return rows[0];
}

export async function fixtures(client) {
  const user = await insert(client, 'users', {
    email: 'alice@example.test',
    id: randomUUID(),
    name: 'Alice',
    password_hash: 'test-only-encoded-hash',
  });
  const otherUser = await insert(client, 'users', {
    email: 'bob@example.test',
    id: randomUUID(),
    name: 'Bob',
    password_hash: 'test-only-encoded-hash',
  });
  const a = await tenant(client, user, 'A');
  const b = await tenant(client, otherUser, 'B');
  b.unusedEvent = await insert(client, 'outbox_events', {
    actor_id: otherUser.id,
    aggregate_id: b.task.id,
    aggregate_type: 'task',
    aggregate_version: 2,
    event_type: 'task.updated',
    id: randomUUID(),
    payload: '{}',
    workspace_id: b.workspace.id,
  });
  await insert(client, 'memberships', {
    role: 'member',
    user_id: user.id,
    workspace_id: b.workspace.id,
  });
  const session = await insert(client, 'refresh_sessions', {
    active_workspace_id: a.workspace.id,
    expires_at: new Date(Date.now() + 86_400_000),
    family_id: randomUUID(),
    id: randomUUID(),
    token_digest: 'a'.repeat(64),
    user_id: user.id,
  });
  await insert(client, 'invitations', {
    created_by_id: user.id,
    email: 'invite@example.test',
    expires_at: new Date(Date.now() + 86_400_000),
    id: randomUUID(),
    role: 'member',
    token_digest: 'b'.repeat(64),
    workspace_id: a.workspace.id,
  });
  await insert(client, 'seed_states', { version: 'integration-fixture' });

  return { a, b, otherUser, session, user };
}

async function tenant(client, user, name) {
  const workspace = await insert(client, 'workspaces', { id: randomUUID(), name });
  await insert(client, 'memberships', {
    role: 'admin',
    user_id: user.id,
    workspace_id: workspace.id,
  });
  const space = await insert(client, 'nodes', {
    id: randomUUID(),
    name: 'Space',
    type: 'space',
    workspace_id: workspace.id,
  });
  const folder = await insert(client, 'nodes', {
    id: randomUUID(),
    name: 'Folder',
    parent_id: space.id,
    type: 'folder',
    workspace_id: workspace.id,
  });
  const list = await insert(client, 'nodes', {
    id: randomUUID(),
    name: 'List',
    parent_id: folder.id,
    type: 'list',
    workspace_id: workspace.id,
  });
  const status = await insert(client, 'status_identities', {
    category: 'not_started',
    id: randomUUID(),
    key: 'todo',
    workspace_id: workspace.id,
  });
  await insert(client, 'status_overrides', {
    id: randomUUID(),
    owner_id: workspace.id,
    owner_type: 'workspace',
    status_id: status.id,
    workspace_id: workspace.id,
  });
  await insert(client, 'field_definitions', {
    id: randomUUID(),
    key: 'size',
    name: 'Size',
    owner_id: workspace.id,
    owner_type: 'workspace',
    type: 'number',
    workspace_id: workspace.id,
  });
  const task = await insert(client, 'tasks', {
    id: randomUUID(),
    primary_list_id: list.id,
    status_id: status.id,
    title: 'Fixture',
    workspace_id: workspace.id,
  });
  await insert(client, 'task_assignees', {
    task_id: task.id,
    user_id: user.id,
    workspace_id: workspace.id,
  });
  await insert(client, 'grants', {
    mode: 'allow',
    resource_id: list.id,
    user_id: user.id,
    workspace_id: workspace.id,
  });
  const event = await insert(client, 'outbox_events', {
    actor_id: user.id,
    aggregate_id: task.id,
    aggregate_type: 'task',
    aggregate_version: 1,
    event_type: 'task.updated',
    id: randomUUID(),
    payload: '{}',
    workspace_id: workspace.id,
  });
  await insert(client, 'activities', {
    actor_id: user.id,
    event_id: event.id,
    id: randomUUID(),
    payload: '{}',
    task_id: task.id,
    type: 'task.status_changed',
    workspace_id: workspace.id,
  });

  return { event, folder, list, space, status, task, workspace };
}
