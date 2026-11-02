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

function componentStructureViolations(file, contents) {
  const source = ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declarations = new Map(
    source.statements
      .filter((node) => ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
      .map((node) => [node.name.text, node.getStart(source)]),
  );
  const components = [];
  const wrapperNames = new Set(['memo', 'forwardRef']);
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'react'
    )
      continue;

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const item of bindings.elements)
        if (['memo', 'forwardRef'].includes((item.propertyName ?? item.name).text))
          wrapperNames.add(item.name.text);
  }
  function signatures(expression) {
    const value = unwrap(expression);
    if (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
      return { functions: [value], types: [] };

    if (!ts.isCallExpression(value)) return null;

    const called = value.expression;
    const name = ts.isIdentifier(called)
      ? called.text
      : ts.isPropertyAccessExpression(called)
        ? called.name.text
        : null;
    if (!wrapperNames.has(name)) return null;

    const wrapped = value.arguments[0] ? signatures(value.arguments[0]) : null;

    return {
      functions: wrapped?.functions ?? [],
      types: [...(value.typeArguments ?? []), ...(wrapped?.types ?? [])],
    };
  }
  function collect(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.body &&
      (node.name
        ? componentName.test(node.name.text)
        : node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
    )
      components.push({
        name: node.name?.text ?? 'default export',
        node,
        functions: [node],
        types: [],
      });

    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const found = signatures(node.expression);
      if (found) components.push({ name: 'default export', node, ...found });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      componentName.test(node.name.text) &&
      node.initializer
    ) {
      const found = signatures(node.initializer);
      if (found)
        components.push({
          name: node.name.text,
          node,
          functions: found.functions,
          types: [...found.types, ...(node.type ? [node.type] : [])],
        });
    }

    ts.forEachChild(node, collect);
  }
  collect(source);
  const issues = [];
  const implementations = components.filter((component) => component.functions.length > 0);
  if (implementations.length > 1)
    issues.push(`split components: ${implementations.map((item) => item.name).join(', ')}`);

  for (const component of components) {
    const types = [
      ...component.types,
      ...component.functions.flatMap((fn) => fn.parameters.flatMap((param) => param.type ?? [])),
    ];
    let inline = false;
    const late = new Set();
    function inspect(node) {
      if (ts.isTypeLiteralNode(node)) inline = true;

      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const position = declarations.get(node.typeName.text);
        if (position !== undefined && position > component.node.getStart(source))
          late.add(node.typeName.text);
      }

      ts.forEachChild(node, inspect);
    }
    types.forEach(inspect);
    if (inline)
      issues.push(`${component.name}: move inline props into a named type above the component`);

    for (const name of late) issues.push(`${component.name}: declare ${name} above the component`);
  }

  return issues.map((issue) => `${file}: ${issue}`);
}

test('component structure checks named props, wrappers, declaration order and separate components', () => {
  for (const contents of [
    'type ProfileProps = { name: string }; export function Profile({ name }: ProfileProps) { return <p>{name}</p>; }',
    'import type { ProfileProps } from "./types"; export const Profile = (props: ProfileProps) => <p />;',
    'type ProfileProps<T> = { value: T }; function Profile<T>(props: ProfileProps<T>) { return <p />; }',
    'const Root = styled("div")({}); function Profile() { return <Root />; }',
    'function Profile(props: PageProps<"/profile">) { const render = () => <p />; return render(); }',
    'type ProfileProps = { name: string }; const Profile = memo(forwardRef<HTMLDivElement, ProfileProps>((props, ref) => <div ref={ref} />));',
    'type ProfileProps = { name: string }; function Profile(props: ProfileProps): unknown; function Profile(props: ProfileProps) { return <p />; }',
    'type ProfileProps = { name: string }; function Profile(props: ProfileProps) { return <p />; } export default memo(Profile);',
    'type ProfileProps = { name: string }; const Profile = memo((props: ProfileProps) => <p />, (previous: { name: string }, next: { name: string }) => previous.name === next.name);',
  ])
    assert.deepEqual(componentStructureViolations('Profile.tsx', contents), []);

  for (const contents of [
    'function Profile(props: { name: string }) { return <p />; }',
    'function Profile(props: Readonly<{ name: string }>) { return <p />; }',
    'function Profile(props: BaseProps & { name: string }) { return <p />; }',
    'const Profile: FC<{ name: string }> = (props) => <p />;',
    'const Profile = memo((props: { name: string }) => <p />);',
    'const Profile = forwardRef<HTMLDivElement, { name: string }>((props, ref) => <div />);',
    'export default function (props: { name: string }) { return <p />; }',
    'export default (props: { name: string }) => <p />;',
    'import { memo as remember } from "react"; const Profile = remember((props: { name: string }) => <p />);',
  ])
    assert.ok(
      componentStructureViolations('Profile.tsx', contents).some((issue) =>
        issue.includes('inline props'),
      ),
    );

  assert.ok(
    componentStructureViolations(
      'Profile.tsx',
      'function Profile(props: ProfileProps) { return <p />; } type ProfileProps = { name: string };',
    ).some((issue) => issue.includes('declare ProfileProps above')),
  );
  assert.ok(
    componentStructureViolations(
      'page.tsx',
      'function Avatar() { return <p />; } export default function Page() { return <Avatar />; }',
    ).some((issue) => issue.includes('split components')),
  );
});

for (const [label, root] of [
  ['web source', new URL('../src/', import.meta.url)],
  ['web routes', new URL('../app/', import.meta.url)],
  ['shared UI', new URL('../../../packages/ui/src/', import.meta.url)],
  ['shared forms', new URL('../../../packages/forms/src/', import.meta.url)],
]) {
  test(`${label} declares component props above one component per file`, async () => {
    const files = (await readdir(root, { recursive: true })).filter((file) =>
      file.endsWith('.tsx'),
    );
    const violations = [];
    for (const file of files)
      violations.push(
        ...componentStructureViolations(file, await readFile(new URL(file, root), 'utf8')),
      );

    assert.deepEqual(violations, []);
  });
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
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => /\.tsx?$/u.test(file) && !file.startsWith('generated/'),
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
