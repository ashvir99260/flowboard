import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import ts from 'typescript';

const componentName = /^[A-Z][a-zA-Z\d]*$/u;
const utilityName = /^[a-z][a-zA-Z\d]*$/u;
const reservedAppFiles = new Set([
  'apple-icon',
  'default',
  'error',
  'forbidden',
  'global-error',
  'icon',
  'layout',
  'loading',
  'manifest',
  'not-found',
  'opengraph-image',
  'page',
  'robots',
  'route',
  'sitemap',
  'template',
  'twitter-image',
  'unauthorized',
]);

function unwrap(expression) {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    return unwrap(expression.expression);

  return expression;
}

function callableComponent(expression) {
  const value = unwrap(expression);
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) return true;

  if (!ts.isCallExpression(value)) return false;

  const called = value.expression;
  const name = ts.isIdentifier(called)
    ? called.text
    : ts.isPropertyAccessExpression(called)
      ? called.name.text
      : null;

  return name === 'memo' || name === 'forwardRef';
}

function componentDeclarations(source) {
  const names = [];
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.body &&
      statement.name &&
      componentName.test(statement.name.text)
    )
      names.push(statement.name.text);

    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          componentName.test(declaration.name.text) &&
          declaration.initializer &&
          callableComponent(declaration.initializer)
        )
          names.push(declaration.name.text);
  }

  return names;
}

function componentReexports(source) {
  return source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    !statement.isTypeOnly &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements
          .filter((element) => !element.isTypeOnly && componentName.test(element.name.text))
          .map((element) => element.name.text)
      : [],
  );
}

function sourceViolations(file, contents) {
  const extension = path.extname(file);
  const name = path.basename(file, extension);
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
  const components = componentDeclarations(source);
  const issues = [];

  if (extension === '.tsx') {
    if (!componentName.test(name)) issues.push('component filename must be PascalCase');

    if (components.length > 1) issues.push(`split components: ${components.join(', ')}`);

    const namedComponents = components.length === 0 ? componentReexports(source) : components;
    if (namedComponents.length !== 1 || namedComponents[0] !== name)
      issues.push('filename must match its component');

    for (const statement of source.statements)
      if (
        ts.isFunctionDeclaration(statement) &&
        statement.name &&
        /^use[A-Z]/u.test(statement.name.text)
      )
        issues.push(`move ${statement.name.text} into a camelCase .ts hook file`);
  } else {
    if (!utilityName.test(name)) issues.push('utility/hook filename must be camelCase');

    if (components.length > 0) issues.push('React components belong in PascalCase .tsx files');
  }

  return issues.map((issue) => `${file}: ${issue}`);
}

test('source naming detects multiple components and ignores private styled slots', () => {
  assert.deepEqual(
    sourceViolations(
      'Profile.tsx',
      "const Root = styled('div')({}); export function Profile() { return <Root />; }",
    ),
    [],
  );
  assert.ok(
    sourceViolations(
      'Profile.tsx',
      'function Avatar() { return null; } export const Profile = memo(() => <Avatar />);',
    ).some((issue) => issue.includes('split components: Avatar, Profile')),
  );
  assert.ok(
    sourceViolations('profile.tsx', 'export function Profile() { return null; }').some((issue) =>
      issue.includes('PascalCase'),
    ),
  );
  assert.deepEqual(
    sourceViolations('profileContext.ts', 'export const ProfileContext = createContext(null);'),
    [],
  );
  assert.deepEqual(sourceViolations('Profile.tsx', "export { Profile } from '@flowboard/ui';"), []);
});

for (const [label, root, isApp] of [
  ['web source', new URL('../src/', import.meta.url), false],
  ['web app components', new URL('../app/', import.meta.url), true],
  ['shared form source', new URL('../../../packages/forms/src/', import.meta.url), false],
]) {
  test(`${label} uses PascalCase components and camelCase hooks/utilities`, async () => {
    const files = (await readdir(root, { recursive: true })).filter((file) =>
      /\.tsx?$/u.test(file),
    );
    const violations = [];
    for (const file of files) {
      const name = path.basename(file, path.extname(file));
      if (isApp && reservedAppFiles.has(name)) continue;

      violations.push(...sourceViolations(file, await readFile(new URL(file, root), 'utf8')));
    }

    assert.deepEqual(violations, []);
  });
}
