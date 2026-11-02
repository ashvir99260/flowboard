import { readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const sessionOperations = new Set([
  'logIn',
  'logOut',
  'refreshSession',
  'signUp',
  'switchWorkspace',
]);
const nonUiOperations = new Set(['getLiveness', 'getReadiness', ...sessionOperations]);

function exportedNames(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const names = new Set();
  for (const statement of source.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
      continue;

    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);

    if (
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      statement.name
    )
      names.add(statement.name.text);
  }

  return names;
}

function exportedFactories(text) {
  const source = ts.createSourceFile('react-query.gen.ts', text, ts.ScriptTarget.Latest, true);
  const result = new Map();
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;

      let kind;
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          if (node.expression.text === 'infiniteQueryOptions') kind = 'infinite';
          else if (node.expression.text === 'queryOptions' && kind !== 'infinite') kind = 'query';
        }

        if (
          !kind &&
          ts.isPropertyAssignment(node) &&
          node.name.getText(source) === 'mutationFn' &&
          declaration.name.text.endsWith('Mutation')
        )
          kind = 'mutation';

        ts.forEachChild(node, visit);
      }
      visit(declaration.initializer);
      if (kind) result.set(declaration.name.text, kind);
    }
  }

  return result;
}

export async function readApiInventory(root) {
  const source = await readFile(path.join(root, '@tanstack/react-query.gen.ts'), 'utf8');
  const types = await readFile(path.join(root, 'types.gen.ts'), 'utf8');
  const names = exportedNames(source, 'react-query.gen.ts');
  const models = exportedNames(types, 'types.gen.ts');
  const operations = [];
  for (const [name, kind] of [...exportedFactories(source)].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    const suffix = { infinite: 'InfiniteOptions', mutation: 'Mutation', query: 'Options' }[kind];
    const id = name.slice(0, -suffix.length);
    if (nonUiOperations.has(id)) continue;

    if (!/^[a-z][A-Za-z0-9]*$/.test(id)) throw new Error(`Unsupported operation name: ${id}`);

    const title = id[0].toUpperCase() + id.slice(1);
    const key = `${id}${kind === 'infinite' ? 'InfiniteQueryKey' : kind === 'query' ? 'QueryKey' : 'MutationKey'}`;
    if (!names.has(key) || !models.has(`${title}Response`) || !models.has(`${title}Error`))
      throw new Error(`Incomplete generated API operation: ${id} (${kind})`);

    operations.push({ id, title, kind, name, key });
  }
  if (
    !operations.some((operation) => operation.kind === 'query') ||
    !operations.some((operation) => operation.kind === 'mutation')
  )
    throw new Error('Generated API inventory is empty or incomplete.');

  return operations;
}

export function renderApiBindings(operations) {
  const imports = operations
    .flatMap(({ name, key, kind }) => (kind === 'mutation' ? [name] : [name, key]))
    .sort();
  const models = [
    ...new Set(operations.flatMap(({ title }) => [`${title}Response`, `${title}Error`])),
  ].sort();
  const chunks = [
    `// Generated from Hey API output by scripts/generate-api-bindings.mjs. Do not edit.\n'use client';\n`,
    `import { ${imports.map((name) => `${name} as hey${name[0].toUpperCase()}${name.slice(1)}`).join(', ')} } from '@flowboard/api-client/tanstack-query';`,
    `import type { ${models.join(', ')} } from '@flowboard/api-client/types';`,
    "import { useQuery, useInfiniteQuery } from '@tanstack/react-query';",
    "import type { InfiniteData, UseQueryOptions, UseQueryResult, UseInfiniteQueryOptions, UseInfiniteQueryResult, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';",
    "import { apiRequest, bindMutation, mergeQueryOptions, scopeQuery, scopeMutation } from '../lib/apiBindings';",
    "import type { ApiContext, ApiParameters, ApiClientParameters } from '../lib/apiBindings';",
    "import { useApiMutation } from '../lib/useApiMutation';",
    `export { ${operations
      .map(({ key }) => key)
      .sort()
      .join(', ')} } from '@flowboard/api-client/tanstack-query';\n`,
  ];
  for (const { title, kind, name, key } of operations) {
    const native = `hey${name[0].toUpperCase()}${name.slice(1)}`;
    const nativeKey = `hey${key[0].toUpperCase()}${key.slice(1)}`;
    const response = `${title}Response`;
    const error = `${title}Error | Error`;
    if (kind === 'query')
      chunks.push(`
export type ${title}QueryParameters = ApiClientParameters<Parameters<typeof ${native}>[0]>;
export type ${title}QueryInput = ApiContext & ApiParameters<${title}QueryParameters>;
export type ${title}QueryKey = ReturnType<typeof ${nativeKey}>;
export type ${title}QueryOptions = Omit<UseQueryOptions<${response}, ${error}, ${response}, ${title}QueryKey>, 'queryKey' | 'queryFn'>;
export type ${title}QueryResult = UseQueryResult<${response}, ${error}>;
export function ${name}(parameters: ${title}QueryParameters, options: ${title}QueryOptions = {}) {
  return mergeQueryOptions(${native}(parameters), options);
}
export function use${title}Query(input: ${title}QueryInput, options: ${title}QueryOptions = {}): ${title}QueryResult {
  return useQuery<${response}, ${error}, ${response}, ${title}QueryKey>(scopeQuery(${name}(apiRequest(input) as ${title}QueryParameters, options), input));
}
`);

    if (kind === 'infinite')
      chunks.push(`
export type ${title}InfiniteQueryParameters = ApiClientParameters<Parameters<typeof ${native}>[0]>;
export type ${title}InfiniteQueryInput = ApiContext & ApiParameters<${title}InfiniteQueryParameters>;
export type ${title}PageKey = ReturnType<typeof ${nativeKey}>;
export type ${title}PageParam = ReturnType<typeof ${native}>['initialPageParam'];
export type ${title}PageData = InfiniteData<${response}, ${title}PageParam>;
export type ${title}InfiniteQueryOptions = Omit<UseInfiniteQueryOptions<${response}, ${error}, ${title}PageData, ${title}PageKey, ${title}PageParam>, 'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'>;
export type ${title}InfiniteHookOptions = ${title}InfiniteQueryOptions & Pick<UseInfiniteQueryOptions<${response}, ${error}, ${title}PageData, ${title}PageKey, ${title}PageParam>, 'initialPageParam' | 'getNextPageParam'>;
export type ${title}InfiniteQueryResult = UseInfiniteQueryResult<${title}PageData, ${error}>;
export function ${name}(parameters: ${title}InfiniteQueryParameters, options: ${title}InfiniteQueryOptions = {}) {
  const definition = ${native}(parameters);
  return mergeQueryOptions({ queryKey: definition.queryKey, queryFn: definition.queryFn }, options);
}
export function use${title}InfiniteQuery(input: ${title}InfiniteQueryInput, options: ${title}InfiniteHookOptions): ${title}InfiniteQueryResult {
  const definition = scopeQuery(${name}(apiRequest(input) as ${title}InfiniteQueryParameters), input);
  return useInfiniteQuery<${response}, ${error}, ${title}PageData, ${title}PageKey, ${title}PageParam>({ ...definition, ...options, queryKey: definition.queryKey, queryFn: definition.queryFn });
}
`);

    if (kind === 'mutation')
      chunks.push(`
export type ${title}MutationVariables = ApiParameters<Parameters<NonNullable<ReturnType<typeof ${native}>['mutationFn']>>[0]>;
export type ${title}MutationParameters = ApiClientParameters<Parameters<typeof ${native}>[0]>;
export type ${title}MutationOptions<TContext = unknown> = Omit<UseMutationOptions<${response}, ${error}, ${title}MutationVariables, TContext>, 'mutationKey' | 'mutationFn' | 'retry' | 'networkMode'>;
export type ${title}MutationResult<TContext = unknown> = UseMutationResult<${response}, ${error}, ${title}MutationVariables, TContext>;
export function ${name}<TContext = unknown>(parameters: ${title}MutationParameters, options: ${title}MutationOptions<TContext> = {}) {
  return bindMutation(${native}(parameters), parameters.client, options);
}
export function use${title}Mutation<TContext = unknown>(input: ApiContext, options: ${title}MutationOptions<TContext> = {}): ${title}MutationResult<TContext> {
  return useApiMutation(scopeMutation(${name}({ client: input.runtime.client }, options), input));
}
`);
  }
  const output = chunks.join('\n');
  const parsed = ts.createSourceFile('apiHooks.gen.ts', output, ts.ScriptTarget.Latest, true);
  const declarations = new Set();
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements) declarations.add(binding.name.text);
  }
  for (const statement of parsed.statements) {
    if (!statement.name || !ts.isIdentifier(statement.name)) continue;

    if (declarations.has(statement.name.text))
      throw new Error(`Generated binding name collision: ${statement.name.text}`);

    declarations.add(statement.name.text);
  }

  return output;
}
