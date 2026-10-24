import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as UI from '../dist/index.js';

const source = new URL('../src/', import.meta.url);

test('shared UI source uses module ownership and camelCase filenames', async () => {
  const files = await readdir(source, { recursive: true, withFileTypes: true });
  assert.ok(files.some((entry) => entry.name === 'modules' && entry.isDirectory()));
  assert.ok(!files.some((entry) => entry.name === 'components' && entry.isDirectory()));
  for (const entry of files.filter((file) => file.isFile())) {
    assert.match(entry.name, /^[a-z][a-zA-Z\d]*\.(?:ts|tsx)$/u, entry.name);
    if (entry.name.endsWith('.tsx')) {
      assert.equal(
        path.relative(fileURLToPath(source), entry.parentPath).split(path.sep)[0],
        'modules',
        `${entry.name} belongs to a UI module`,
      );
      const contents = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
      const components = [...contents.matchAll(/export (?:function|const) ([A-Z]\w*)/gu)];
      assert.ok(components.length <= 1, `${entry.name} has one public component implementation`);
    }
  }
});

test('UI module refactoring preserves the public component contract', () => {
  for (const name of [
    'ActivityPanel',
    'ActivityTimeline',
    'AssigneeAvatarGroup',
    'AuthPanel',
    'BoardDropzone',
    'BoardGrid',
    'BoardItem',
    'BoardViewport',
    'Button',
    'Chip',
    'ConfirmDialog',
    'CustomFieldChip',
    'CustomFieldInput',
    'Dialog',
    'DrawerPanel',
    'DueDateLabel',
    'EmptyState',
    'ErrorState',
    'FieldPreview',
    'FormField',
    'KanbanCard',
    'KanbanColumn',
    'LoadingState',
    'MarkdownContent',
    'NativeSelect',
    'Paper',
    'PriorityBadge',
    'StatusChip',
    'StatusPreview',
    'Surface',
    'TaskTable',
    'TextField',
    'ThemeProvider',
    'ToastHost',
    'ToastRegion',
    'Toolbar',
    'TreeItem',
    'WorkspaceLayout',
    'designTokens',
    'theme',
    'toHslColor',
    'useThemeMode',
  ]) {
    assert.ok(UI[name], `missing public UI export ${name}`);
  }
  assert.deepEqual(Object.keys(UI.Surface).sort(), [
    'Body',
    'Description',
    'Footer',
    'Header',
    'Root',
    'Title',
  ]);
  assert.deepEqual(Object.keys(UI.Toolbar).sort(), ['Group', 'Root']);
});
