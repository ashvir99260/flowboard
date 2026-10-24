# Shared code readability

These rules apply to authored frontend, backend, shared packages and tooling. Node, React and Next.js use the same shared ESLint spacing configuration. D97 records the control-flow policy.

## Conditionals and returns

- Put a blank line after a complete `if` or `if/else` chain when another statement follows. This includes an early-return guard.
- Put a blank line before `return` when another statement precedes it in the same block.
- Put a blank line after `return` if another statement follows in the same block. This formatting rule does not permit unreachable code; existing reachability checks still apply.
- Keep `else` and `else if` attached to their conditional. Keep final returns next to their closing brace; do not add padding inside an otherwise empty scope.
- Keep a return expression attached to its `return` keyword. A newline inserted between them can change JavaScript behavior.
- Preserve leading and trailing comments. Use comments to explain a decision, rather than narrating each statement.

For example:

```ts
export function labelFor(name: string | undefined) {
  if (!name) {
    return 'Untitled';
  }

  const label = name.trim();

  return label || 'Untitled';
}
```

This also applies to JSX returns and NestJS service/controller methods. Existing export and module declarations keep a blank line before the next statement; decorators remain attached to their class.

## Existing conventions

[NAMING_CONVENTIONS.md](NAMING_CONVENTIONS.md) maps names and file roles to actual source examples and identifies which rules are automated.

Use `const` unless reassignment is necessary, type-only imports where appropriate, descriptive camelCase values, and PascalCase types/components. Keep pure helpers small, avoid nested conditionals when a guard improves clarity, and retain normal branching when a lookup table would obscure validation or authorization. Keep functions focused on one responsibility; there is no arbitrary function-length rule.

Existing shared lint also checks unused imports, import order and boundaries, selected SonarJS correctness rules, and safe sorting of applicable type/object/JSX members. React/Next presets include their framework and accessibility checks. Do not sort package.json properties or reorder runtime-sensitive object initialization to satisfy a style preference.

## Apply and verify

Run `pnpm lint:fix` to apply supported lint fixes, then `pnpm format` for the shared Prettier format. Run `pnpm lint` and `pnpm format:check` to verify them. Behavioral tests cover all three presets and check that spacing fixes remain stable through Prettier.

Generated sources, build output and JSON are excluded from statement-padding rules. Never edit generated clients to satisfy formatting; change their generator or schema only when the task requires it. Rule definitions live in [spacing.mjs](../packages/config-eslint/src/spacing.mjs), with executable fixtures in [spacing.test.mjs](../packages/config-eslint/test/spacing.test.mjs).
