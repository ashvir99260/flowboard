import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

const modules = [
  'workspaces/useListWorkspacesInfiniteQuery',
  'tasks/useListTaskActivityInfiniteQuery',
  'search/useSearchWorkspaceInfiniteQuery',
  'tasks/useListRelatedTasksInfiniteQuery',
  'administration/useAdministration',
  'tree/useTree',
  'config/fields/useFieldConfiguration',
  'config/statuses/useStatusConfiguration',
  'board/useBoard',
  'board/useMoveDestination',
  'list/useListQuery',
  'tasks/useTaskDetail',
  'workspace-board/useWorkspaceBoardQuery',
  'administration/useAdministrationMutation',
  'config/fields/useFieldMutation',
  'config/statuses/useStatusMutation',
  'list/useBulkUpdateTasksMutation',
  'tasks/useTaskWriteMutation',
  'board/useTaskPlacementMutation',
  'workspaces/useWorkspaceMutation',
  'workspaces/useCreateWorkspaceInvitationMutation',
  'workspaces/useAcceptWorkspaceInvitationMutation',
];

test('authored API hooks declare public option and result contracts', async () => {
  for (const modulePath of modules) {
    const text = await readFile(
      new URL(`../src/features/${modulePath}.ts`, import.meta.url),
      'utf8',
    );
    const source = ts.createSourceFile(modulePath, text, ts.ScriptTarget.Latest, true);
    const exported = source.statements.filter((node) =>
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    );
    const hook = exported.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === modulePath.split('/').at(-1),
    );
    assert.ok(hook?.type, `${modulePath}: declare the hook result type`);
    const manualEndpointImport = source.statements.some(
      (node) =>
        ts.isImportDeclaration(node) &&
        ['@flowboard/api-client/sdk', '@flowboard/api-client/tanstack-query'].includes(
          node.moduleSpecifier.text,
        ),
    );
    assert.equal(
      manualEndpointImport,
      false,
      `${modulePath}: consume generated web endpoint bindings`,
    );
    const aliases = exported.filter(ts.isTypeAliasDeclaration).map((node) => node.name.text);
    assert.ok(
      aliases.some((name) => name.endsWith('Options')),
      `${modulePath}: export typed options`,
    );
    assert.ok(
      aliases.some((name) => name.endsWith('Result')),
      `${modulePath}: export a result alias`,
    );
  }
});
