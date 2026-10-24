const effectHooks = new Set(['useEffect', 'useInsertionEffect', 'useLayoutEffect']);
const wrappers = new Set([
  'ChainExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);
const isHook = (name) => name === 'use' || /^use[A-Z0-9]/.test(name);

function unwrap(node) {
  while (node && wrappers.has(node.type)) node = node.expression;

  return node;
}

function importBinding(source, identifier) {
  for (let scope = source.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name);
    if (variable) return variable.defs.find((definition) => definition.type === 'ImportBinding');
  }

  return undefined;
}

function hookName(source, expression) {
  const call = unwrap(expression);
  if (call?.type !== 'CallExpression') return undefined;

  const callee = unwrap(call.callee);
  if (callee.type === 'Identifier') {
    const binding = importBinding(source, callee);
    const imported = binding?.node.type === 'ImportSpecifier' ? binding.node.imported : undefined;
    const name = imported?.name ?? imported?.value;

    return name && isHook(name) ? name : isHook(callee.name) ? callee.name : undefined;
  }

  if (callee.type !== 'MemberExpression' || callee.computed || callee.object.type !== 'Identifier')
    return undefined;

  const binding = importBinding(source, callee.object);
  const reactNamespace =
    binding?.parent.source.value === 'react' &&
    ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(binding.node.type);

  return reactNamespace && isHook(callee.property.name) ? callee.property.name : undefined;
}

function hookKind(source, statement) {
  if (statement.type === 'ExpressionStatement') {
    return hookName(source, statement.expression) ? 'effect' : undefined;
  }

  if (statement.type !== 'VariableDeclaration') return undefined;

  const names = statement.declarations
    .map((declaration) => hookName(source, declaration.init))
    .filter(Boolean);
  if (names.length === 0) return undefined;

  return names.some((name) => effectHooks.has(name)) ? 'effect' : 'value';
}

export default {
  meta: {
    docs: { description: 'Separate React hook groups without reordering statements' },
    fixable: 'whitespace',
    messages: { spacing: 'Separate this hook section with a blank line.' },
    schema: [],
    type: 'layout',
  },
  create(context) {
    const source = context.sourceCode;
    const eol = source.text.includes('\r\n') ? '\r\n' : '\n';

    return {
      BlockStatement(block) {
        for (let index = 1; index < block.body.length; index += 1) {
          const previous = block.body[index - 1];
          const current = block.body[index];
          const before = hookKind(source, previous);
          const after = hookKind(source, current);
          if ((!before && !after) || (before === 'value' && after === 'value')) continue;

          // Keep same-line trailing comments with the previous statement, and
          // leave leading comments attached to the following statement.
          const comments = source.getTokensBetween(previous, current, { includeComments: true });
          let left = previous;
          let position = 0;
          while (comments[position]?.loc.start.line === left.loc.end.line) {
            left = comments[position];
            position += 1;
          }
          const right = comments[position] ?? current;
          const gap = source.text.slice(left.range[1], right.range[0]);
          if (/\r?\n[\t ]*\r?\n/.test(gap)) continue;

          const lineSensitive = comments
            .slice(0, position)
            .some((comment) =>
              /(?:\beslint-disable-next-line|@ts-(?:ignore|expect-error))\b/.test(comment.value),
            );

          context.report({
            node: current,
            messageId: 'spacing',
            fix: lineSensitive
              ? undefined
              : (fixer) => fixer.insertTextAfter(left, /[\r\n]/.test(gap) ? eol : eol + eol),
          });
        }
      },
    };
  },
};
