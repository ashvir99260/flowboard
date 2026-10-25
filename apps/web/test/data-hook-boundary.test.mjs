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

function mutationViolations(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  const namespaces = new Set();
  const mutationHooks = new Set();
  const commonHook = file === 'src/lib/useApiMutation.ts';

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;

    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;

    const bindings = clause.namedBindings;
    const tanstack = statement.moduleSpecifier.text === '@tanstack/react-query';
    if (tanstack && bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);

    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const item of bindings.elements) {
      if (item.isTypeOnly) continue;

      const imported = (item.propertyName ?? item.name).text;
      if (tanstack && imported === 'useMutation' && !commonHook)
        violations.push(`${file}: import useMutation through useApiMutation`);

      if (imported === 'useApiMutation') mutationHooks.add(item.name.text);
    }
  }

  function visit(node) {
    if (!commonHook) {
      const member = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : undefined;
      if (
        member === 'useMutation' &&
        ts.isIdentifier(node.expression) &&
        namespaces.has(node.expression.text)
      )
        violations.push(`${file}: access useMutation through useApiMutation`);

      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        namespaces.has(node.initializer.text) &&
        ts.isObjectBindingPattern(node.name) &&
        node.name.elements.some((item) => {
          const name = item.propertyName ?? item.name;

          return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'useMutation';
        })
      )
        violations.push(`${file}: destructure useMutation through useApiMutation`);
    }

    ts.forEachChild(node, visit);
  }
  visit(source);

  function callsMutation(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      if (mutationHooks.has(node.expression.text)) return true;

    return ts.forEachChild(node, callsMutation);
  }

  if (file.startsWith('src/features/'))
    for (const statement of source.statements) {
      if (!statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) continue;

      const declarations = ts.isFunctionDeclaration(statement)
        ? [statement]
        : ts.isVariableStatement(statement)
          ? statement.declarationList.declarations
          : [];
      for (const declaration of declarations)
        if (
          declaration.name &&
          ts.isIdentifier(declaration.name) &&
          callsMutation(declaration) &&
          !/^use[A-Z]\w*Mutation$/.test(declaration.name.text)
        )
          violations.push(
            `${file}: ${declaration.name.text} must use the use<Operation>Mutation name`,
          );
    }

  return violations;
}

test('mutation boundaries reject aliases and namespace access while enforcing feature hook names', () => {
  for (const source of [
    "import { useMutation as useWrite } from '@tanstack/react-query';",
    "import * as query from '@tanstack/react-query'; query.useMutation({});",
    "import * as query from '@tanstack/react-query'; query['useMutation']({});",
    "import * as query from '@tanstack/react-query'; const { useMutation: useWrite } = query;",
    "import { useApiMutation as useWrite } from '../../lib/useApiMutation'; export function useSave() { return useWrite({}); }",
  ])
    assert.equal(mutationViolations('src/features/example/useSave.ts', source).length, 1);

  assert.deepEqual(
    mutationViolations(
      'src/features/example/useSaveMutation.ts',
      "import { useApiMutation as useWrite } from '../../lib/useApiMutation'; export function useSaveMutation() { return useWrite({}); }",
    ),
    [],
  );
  assert.deepEqual(
    mutationViolations(
      'src/lib/useApiMutation.ts',
      "import { useMutation } from '@tanstack/react-query'; export function useApiMutation() { return useMutation({}); }",
    ),
    [],
  );
});

test('UI mutations use the common policy and named feature hooks', async () => {
  const root = new URL('../', import.meta.url);
  const violations = [];
  for (const directory of ['src', 'app']) {
    const files = (await readdir(new URL(`${directory}/`, root), { recursive: true })).filter(
      (file) => /\.tsx?$/.test(file),
    );
    for (const file of files) {
      const path = `${directory}/${file}`;
      violations.push(...mutationViolations(path, await readFile(new URL(path, root), 'utf8')));
    }
  }

  assert.deepEqual(violations, []);
});
