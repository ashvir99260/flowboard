# Shared package instructions

Read the [root instructions](../AGENTS.md), [guide map](../docs/agents/README.md) and the package's scoped instructions.

Each package owns one responsibility, public exports, build/check scripts and declared Turbo outputs. Extend shared compiler/lint/Prettier configuration. Use `workspace:*` for local links and exact compatible external versions; preserve package.json order. Keep native ESM and NodeNext `.js` import paths where applicable.

Apps may consume packages. Packages may not import app internals, except OpenAPI's isolated build-time spec entry. Use public package exports, not sibling source paths. Put pure reusable logic in contracts only when it fits their framework-free domain boundary. Do not create speculative packages or duplicate application logic.

Configuration changes need positive/negative fixtures for the actual rule, including safe autofix behavior where relevant. Package tests belong with their owner; keep runtime output and generated files excluded from hand edits. Follow [code quality](../docs/CODE_QUALITY.md), [readability](../docs/CODE_STYLE.md), [naming](../docs/NAMING_CONVENTIONS.md) and the root verification workflow.
