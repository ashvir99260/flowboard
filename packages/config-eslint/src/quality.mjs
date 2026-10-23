import perfectionist from 'eslint-plugin-perfectionist';
import sonarjs from 'eslint-plugin-sonarjs';
import unusedImports from 'eslint-plugin-unused-imports';

export const codeFiles = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'];

const order = { order: 'asc', partitionByComment: true, type: 'natural' };
// An expression blacklist misses coercion and tagged-template calls. Only direct
// literal values qualify; binding patterns can still read inherited getters.
const literal =
  'ObjectExpression:not(:has(Property[value.type!="Literal"])):not(:has(Property[computed=true])):not(:has(SpreadElement))';
const literalProps =
  'JSXElement:not(:has(JSXSpreadAttribute)):not(:has(JSXAttribute[value][value.type!="Literal"][value.type!="JSXExpressionContainer"])):not(:has(JSXAttribute[value.type="JSXExpressionContainer"][value.expression.type!="Literal"]))';
const overloads =
  ':not(:has(TSMethodSignature)):not(:has(TSCallSignatureDeclaration)):not(:has(TSConstructSignatureDeclaration))';

export default {
  plugins: { perfectionist, sonarjs, 'unused-imports': unusedImports },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'error',
      { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      { format: ['PascalCase'], selector: 'typeLike' },
    ],
    'perfectionist/sort-named-imports': ['error', order],
    'perfectionist/sort-named-exports': ['error', order],
    'perfectionist/sort-interfaces': [
      'error',
      {
        ...order,
        useConfigurationIf: {
          matchesAstSelector: `TSInterfaceDeclaration${overloads}`,
        },
      },
      { type: 'unsorted' },
    ],
    'perfectionist/sort-object-types': [
      'error',
      {
        ...order,
        useConfigurationIf: { matchesAstSelector: `TSTypeLiteral${overloads}` },
      },
      { type: 'unsorted' },
    ],
    'perfectionist/sort-objects': [
      'error',
      { ...order, useConfigurationIf: { matchesAstSelector: literal } },
      { type: 'unsorted' },
    ],
    'sonarjs/no-identical-expressions': 'error',
    'sonarjs/no-identical-conditions': 'error',
    'sonarjs/no-element-overwrite': 'error',
    'sonarjs/no-inverted-boolean-check': 'error',
    'sonarjs/no-redundant-boolean': 'error',
  },
};

export const jsxQuality = {
  files: ['**/*.{jsx,tsx}'],
  rules: {
    'perfectionist/sort-jsx-props': [
      'error',
      {
        order: 'asc',
        type: 'natural',
        useConfigurationIf: { matchesAstSelector: literalProps },
      },
      { type: 'unsorted' },
    ],
    'react/jsx-pascal-case': 'error',
    // CSS-in-JS property order can affect shorthand/longhand precedence.
    'perfectionist/sort-objects': 'off',
  },
};
