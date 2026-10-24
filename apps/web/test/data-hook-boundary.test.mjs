import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

test('feature view components consume data hooks instead of configuring TanStack queries', async () => {
  const root = new URL('../src/features/', import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith('.tsx'));
  const violations = [];

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      await readFile(new URL(file, root), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;

      const name = statement.moduleSpecifier.text;
      if (name === '@tanstack/react-query' || name === '@flowboard/api-client/tanstack-query')
        violations.push(`${file}: ${name}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    'Move query configuration into named feature hooks (use<Operation>Query or use<Operation>InfiniteQuery).',
  );
});
