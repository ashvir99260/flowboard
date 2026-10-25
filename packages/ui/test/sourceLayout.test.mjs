import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import * as UI from '../dist/index.js';

const source = new URL('../src/', import.meta.url);

test('shared UI source uses PascalCase components and camelCase hooks/utilities', async () => {
  const files = await readdir(source, { recursive: true, withFileTypes: true });
  assert.ok(files.some((entry) => entry.name === 'modules' && entry.isDirectory()));
  assert.ok(!files.some((entry) => entry.name === 'components' && entry.isDirectory()));
  for (const entry of files.filter((file) => file.isFile())) {
    if (entry.name.endsWith('.tsx')) {
      assert.match(entry.name, /^[A-Z][a-zA-Z\d]*\.tsx$/u, entry.name);
      assert.equal(
        path.relative(fileURLToPath(source), entry.parentPath).split(path.sep)[0],
        'modules',
        `${entry.name} belongs to a UI module`,
      );
      const contents = await readFile(path.join(entry.parentPath, entry.name), 'utf8');
      const parsed = ts.createSourceFile(entry.name, contents, ts.ScriptTarget.Latest, true);
      const components = [...contents.matchAll(/export (?:function|const) ([A-Z]\w*)/gu)];
      const implementations = new Set(components.map((component) => component[1]));
      for (const statement of parsed.statements) {
        if (
          ts.isFunctionDeclaration(statement) &&
          statement.body &&
          statement.name &&
          /^[A-Z]/u.test(statement.name.text)
        )
          implementations.add(statement.name.text);

        if (ts.isVariableStatement(statement))
          for (const declaration of statement.declarationList.declarations)
            if (
              ts.isIdentifier(declaration.name) &&
              /^[A-Z]/u.test(declaration.name.text) &&
              declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer))
            )
              implementations.add(declaration.name.text);
      }

      assert.equal(implementations.size, 1, `${entry.name} has one component implementation`);
      assert.equal(components.length, 1, `${entry.name} exports one public component`);
      assert.equal(components[0][1], path.basename(entry.name, '.tsx'));
    } else {
      assert.match(entry.name, /^[a-z][a-zA-Z\d]*\.ts$/u, entry.name);
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
