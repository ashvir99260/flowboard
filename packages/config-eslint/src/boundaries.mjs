import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runtimeDependencies = {
  api: ['contracts', 'database', 'logger'],
  'api-client': ['contracts'],
  contracts: [],
  database: ['contracts', 'logger'],
  forms: ['contracts', 'ui'],
  logger: [],
  openapi: ['contracts'],
  ui: ['contracts'],
  web: ['contracts', 'api-client', 'ui', 'forms'],
  worker: ['contracts', 'database', 'logger'],
};

function workspaceFor(root, filename) {
  const [group, name] = path.relative(root, filename).split(path.sep);
  if (!['apps', 'packages'].includes(group) || !name) return undefined;

  return { group, name, directory: path.join(root, group, name) };
}

function compilerOptions(owner) {
  const config = path.join(owner.directory, 'tsconfig.json');
  if (!existsSync(config)) return {};

  const input = ts.readConfigFile(config, ts.sys.readFile);
  if (input.error) return {};

  return ts.parseJsonConfigFileContent(input.config, ts.sys, owner.directory, {}, config).options;
}

function resolveAlias(owner, specifier, options) {
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const [prefix, suffix = ''] = pattern.split('*');
    const matches = pattern.includes('*')
      ? specifier.startsWith(prefix) && specifier.endsWith(suffix)
      : specifier === pattern;
    if (!matches || !targets[0]) continue;

    const wildcard = specifier.slice(prefix.length, specifier.length - suffix.length || undefined);

    return path.resolve(
      options.baseUrl ?? options.pathsBasePath ?? owner.directory,
      targets[0].replace('*', wildcard),
    );
  }

  return undefined;
}

export default {
  meta: {
    docs: { description: 'Enforce Flowboard workspace and generated-client boundaries' },
    messages: { boundary: '{{reason}}' },
    schema: [
      { additionalProperties: false, properties: { root: { type: 'string' } }, type: 'object' },
    ],
    type: 'problem',
  },
  create(context) {
    const root = context.options[0]?.root ?? repositoryRoot;
    const filename = context.filename;
    const owner = workspaceFor(root, filename);
    if (!owner) return {};

    const options = compilerOptions(owner);
    const inSource = /(^|[/\\])(src|app)[/\\]/.test(path.relative(owner.directory, filename));
    const isApiProxy =
      path.relative(root, filename).split(path.sep).join('/') ===
        'apps/web/src/server/apiProxy.ts' &&
      context.sourceCode.ast.body.some(
        (node) => node.type === 'ImportDeclaration' && node.source.value === 'server-only',
      );
    const report = (node, reason) =>
      context.report({ data: { reason }, messageId: 'boundary', node });

    function check(node, specifier) {
      if (typeof specifier !== 'string') return;

      if (
        ['web', 'forms'].includes(owner.name) &&
        ['src', 'app'].includes(path.relative(owner.directory, filename).split(path.sep)[0]) &&
        /^@mui(?:\/|$)/.test(specifier)
      ) {
        report(node, 'Import presentation from @flowboard/ui; Material belongs in packages/ui.');

        return;
      }

      if (owner.name === 'contracts' && inSource && !specifier.startsWith('.')) {
        if (specifier !== 'zod' && !specifier.startsWith('zod/')) {
          report(node, 'Contracts runtime code may import only Zod and its own files.');

          return;
        }
      }

      if (/(^|[/\\])(@prisma|\.prisma)[/\\]/.test(specifier) && owner.name !== 'database') {
        report(node, 'Raw Prisma imports belong in packages/database.');

        return;
      }

      if (
        inSource &&
        ['web', 'ui', 'forms'].includes(owner.name) &&
        /^(axios|undici|node:https?)(\/|$)/.test(specifier)
      ) {
        report(node, 'Use generated operations from packages/api-client for HTTP requests.');

        return;
      }

      if (
        inSource &&
        owner.name === 'ui' &&
        /^(socket\.io-client|@tanstack\/|@hey-api\/|react-hook-form(?:\/|$)|next\/(?:navigation|(?:compat\/)?router)(?:\.js)?(?:\/|$))/.test(
          specifier,
        )
      ) {
        report(node, 'Shared UI components are presentational; data clients belong in apps/web.');

        return;
      }

      if (
        inSource &&
        owner.name === 'forms' &&
        /^(socket\.io-client|@tanstack\/|@hey-api\/|next\/)/.test(specifier)
      ) {
        report(node, 'Shared forms cannot import data clients or router code.');

        return;
      }

      const alias = resolveAlias(owner, specifier, options);
      const resolved =
        alias ??
        (specifier.startsWith('file:')
          ? fileURLToPath(specifier)
          : path.isAbsolute(specifier)
            ? specifier
            : specifier.startsWith('.')
              ? path.resolve(path.dirname(filename), specifier)
              : undefined);
      if (
        resolved &&
        /(^|[/\\])(@prisma|\.prisma)[/\\]/.test(resolved) &&
        owner.name !== 'database'
      ) {
        report(node, 'Raw Prisma imports belong in packages/database.');

        return;
      }

      const workspaceName = specifier.match(/^@flowboard\/([^/]+)/)?.[1];
      if (!resolved && !workspaceName) return;

      const target = resolved
        ? workspaceFor(root, resolved)
        : workspaceFor(
            root,
            path.join(
              root,
              existsSync(path.join(root, 'apps', workspaceName)) ? 'apps' : 'packages',
              workspaceName,
            ),
          );
      if (resolved && owner.group === 'apps' && owner.name === 'api' && target?.name === 'api') {
        const sourceRoot = path.join(owner.directory, 'src');
        const fromLayer = path.relative(sourceRoot, filename).split(path.sep)[0];
        const toLayer = path.relative(sourceRoot, resolved).split(path.sep)[0];
        if (
          (fromLayer === 'core' && ['shared', 'modules'].includes(toLayer)) ||
          (fromLayer === 'shared' && toLayer === 'modules')
        ) {
          report(
            node,
            `API ${fromLayer} cannot import ${toLayer}; dependencies point toward core.`,
          );

          return;
        }
      }

      if (!target || target.name === owner.name) return;

      if (resolved) {
        report(
          node,
          'Cross-workspace paths and aliases must use the target package public export.',
        );

        return;
      }

      if (target.group === 'apps') {
        const toolingException =
          owner.name === 'openapi' &&
          path.relative(owner.directory, filename).startsWith(`scripts${path.sep}`) &&
          specifier === '@flowboard/api/spec';
        if (!toolingException) report(node, 'Applications cannot be imported across workspaces.');

        return;
      }

      if (target.name.startsWith('config-') && (!inSource || owner.name.startsWith('config-')))
        return;

      const allowed = runtimeDependencies[owner.name];
      if (allowed && !allowed.includes(target.name)) {
        report(
          node,
          `${owner.name} cannot import ${target.name}; use its documented layer boundary.`,
        );
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression(node) {
        if (inSource && typeof node.source.value !== 'string') {
          report(
            node,
            'Runtime import targets must be static so package boundaries can be checked.',
          );
        } else {
          check(node, node.source.value);
        }
      },
      TSImportType: (node) => check(node, node.argument.literal?.value ?? node.argument.value),
      TSImportEqualsDeclaration: (node) => check(node, node.moduleReference.expression?.value),
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          if (inSource && typeof node.arguments[0]?.value !== 'string') {
            report(
              node,
              'Runtime require targets must be static so package boundaries can be checked.',
            );
          } else {
            check(node, node.arguments[0]?.value);
          }
        }

        const directFetch = node.callee.type === 'Identifier' && node.callee.name === 'fetch';
        const globalFetch =
          node.callee.type === 'MemberExpression' &&
          ['window', 'globalThis'].includes(node.callee.object.name) &&
          (node.callee.property.name ?? node.callee.property.value) === 'fetch';
        if (
          inSource &&
          !isApiProxy &&
          ['web', 'ui', 'forms'].includes(owner.name) &&
          (directFetch || globalFetch)
        ) {
          report(
            node,
            'Use generated API operations; presentation code cannot fetch endpoints directly.',
          );
        }
      },
    };
  },
};
