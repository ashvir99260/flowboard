import semver from 'semver';

const sections = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]);

function isExact(value) {
  return (
    value === 'workspace:*' ||
    (typeof value === 'string' &&
      value === value.trim() &&
      /^\d/.test(value) &&
      semver.valid(value) !== null)
  );
}

export default {
  meta: {
    docs: { description: 'Require exact package dependency versions or workspace:*' },
    messages: {
      exact:
        'Pin {{section}}.{{dependency}} to an exact version (for example 1.2.3) or workspace:*.',
      section: '{{section}} must be an object of exact dependency versions.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    return {
      JSONProperty(node) {
        const section = node.key.value;
        if (node.parent?.parent?.type !== 'JSONExpressionStatement' || !sections.has(section))
          return;

        if (node.value.type !== 'JSONObjectExpression') {
          context.report({ data: { section }, messageId: 'section', node: node.value });
          return;
        }

        for (const dependency of node.value.properties) {
          if (!isExact(dependency.value.value)) {
            context.report({
              data: { dependency: dependency.key.value, section },
              messageId: 'exact',
              node: dependency.value,
            });
          }
        }
      },
    };
  },
};
