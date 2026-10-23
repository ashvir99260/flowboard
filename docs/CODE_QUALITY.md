# Code quality and commit conventions

## Commit messages

Use Conventional Commits, for example `feat(tasks): add status changes`, `fix(auth): reject expired sessions`, or `docs: explain workspace permissions`. Breaking changes use `!` or a `BREAKING CHANGE:` footer. Headers are limited to 100 characters. Standard merge/revert messages have explicit exemptions; empty and version-only messages are rejected; PR titles must themselves be conventional because they may become squash commits.

The shared policy uses pinned commitlint 21.2.4 and its conventional preset. Enable the tracked commit-msg hook once per clone:

```sh
pnpm hooks:install
```

This changes only the repository's local Git configuration. It refuses to replace a different existing hook path, including an inherited one; in that case add commitlint to your existing hook explicitly. No global hooks, install-time hook changes or paid service is involved. To check a message file or recent commits manually:

```sh
pnpm commitlint -- --edit /absolute/path/to/message.txt
pnpm commitlint -- --from HEAD~1 --to HEAD
```

CI runs `pnpm commitlint:ci` in the existing parallel lint job. It reads event JSON to check PR base..head commits and the PR title, push before..after commits, or HEAD for manual runs. First pushes check all reachable commits; unavailable/malformed revisions fail rather than silently reducing coverage. PR title edits trigger validation again. User-supplied titles are passed as data, never shell commands. Read-only PR permissions and release gates remain in place.

## Shared linting

Node/Nest code, Next.js and the presentational UI package use shared flat configs. Each package owns `lint` and `lint:fix`; root commands run them through Turbo. Warnings fail CI. The shared config task also checks root JSON and the bootstrap TypeScript package's JSON, with explicit Turbo cache inputs. This avoids a configuration dependency cycle. Generated clients/specs, build outputs and local tool data are excluded.

```sh
pnpm lint
pnpm lint:fix
pnpm format
```

ESLint handles correctness and ordering; Prettier handles formatting. Review fixes before committing. The JSON sorter works incrementally and a large unsorted file may need another `pnpm lint:fix` pass.

| Concern                                                  | Choice                                                                       | Reason                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Import declarations                                      | Existing `eslint-plugin-import-x` 4.17.1                                     | Retain one import-order rule; no second declaration sorter. Next retains its own required dependencies.                                                                        |
| Named imports/exports, types, safe objects and JSX props | `eslint-plugin-perfectionist` 5.13.0                                         | Natural ascending order with safety boundaries described below; no duplicate destructuring sorter.                                                                             |
| Suspicious logic                                         | `eslint-plugin-sonarjs` 4.2.2                                                | Selected non-type-aware rules for identical expressions/conditions, overwritten array elements, inverted checks and redundant booleans. This is not a complete security audit. |
| Unused code                                              | `eslint-plugin-unused-imports` 4.4.1                                         | Owns import/variable diagnostics; competing core/TypeScript unused rules are disabled. Explicit side-effect imports stay intact. Intentional unused arguments use `_`.         |
| Authored JSON/JSONC                                      | `eslint-plugin-jsonc` 3.4.2                                                  | Sorted object keys outside package manifests, plus syntax/duplicate-key checks; JSON receives its own language configuration.                                                  |
| Dependency versions                                      | Local `flowboard/require-exact-dependency-versions` rule with `semver` 7.8.5 | Exact dependency declarations without modifying package manifest order or guessing replacement versions.                                                                       |
| React, Hooks, accessibility                              | React 7.37.5, Hooks 7.1.1, JSX a11y 6.10.2                                   | Next's existing presets cover web; the shared React preset also covers `packages/ui`.                                                                                          |
| Formatting                                               | Existing `eslint-config-prettier` 10.1.8 plus Prettier                       | Avoid duplicate formatting diagnostics and the extra cost of running Prettier as an ESLint rule.                                                                               |

`eslint-plugin-prettier`, the older `eslint-plugin-import`, and `eslint-plugin-sort-destructure-keys` are not added as competing direct tools. TypeScript import resolution already comes with Next; there is no new unresolved-import rule requiring another resolver configuration. Compatible versions are pinned instead of copying the older ranges in the request. ESLint remains on the existing 9.39.5 line; the React plugin's peer range does not yet support an ESLint 10 migration.

### Naming and ordering boundaries

- Classes, interfaces, type aliases and enums have automated PascalCase checks. Component declarations follow PascalCase as a review convention; the React rule checks JSX references, but cannot infer every component declaration from its name. Ordinary functions/variables and external contract keys retain camelCase or their documented external spelling; casing does not rename API fields.
- Sort ordinary type properties, named import/export specifiers and safe JSX props. Preserve overload-containing interfaces/types and meaningful array, enum, class/decorator and positional-parameter order.
- Sort runtime objects only when every property has a direct literal value, with no computed keys or spreads. Expressions, including coercions and tagged templates, remain ordered. Such sorting intentionally changes property enumeration order; an order-sensitive map must remain in a semantic sequence such as an array, or have a narrowly explained rule exception.
- Destructuring and positional arguments preserve their evaluation order, including patterns whose source is a literal: missing keys can still read inherited getters. Object parameter **type members** still sort. A cosmetic rule must not change default dependencies or getter behavior.
- JSX props sort only for bare attributes, strings and direct literal expressions without spreads. Runtime object sorting is disabled in JSX/TSX because CSS-in-JS shorthand/longhand order can be meaningful. Props and type members still sort where safe.
- All `package.json` key order is preserved, including dependencies, scripts and conditional exports/imports. Other authored JSON objects sort naturally; arrays keep their order. `.json` uses strict JSON checks; comments/trailing commas are permitted only in `.jsonc`.

### Exact dependency versions

Root, app and package manifests all require exact semantic versions in `dependencies`, `devDependencies`, `optionalDependencies` and `peerDependencies`. Examples: `"1.2.3"`, `"1.2.3-beta.1"` and `"1.2.3+build.1"`. Local packages keep `"workspace:*"`.

Ranges (`^`, `~`, comparisons, wildcards and partial versions), tags such as `latest`, noncanonical prefixes/whitespace, Git/URL/file/link sources and npm aliases fail lint. Invalid values and malformed dependency sections also fail. The rule has no autofix: choosing a new version requires a deliberate dependency update and lockfile validation. Node engine compatibility ranges are not dependency versions and stay allowed. `.npmrc` already uses `save-exact=true`; ESLint catches manual edits too. See [D60](DECISIONS.md) and [P00-22](TASKS.md).

### Manifest layout

Keep manifests easy to scan: package identity (`name`, `version`, `private`, `type`), relevant toolchain metadata, public exports/files, scripts, dependencies and formatter settings. Omit fields a package does not need. This is a readability convention, not an automatic sort rule or an npm requirement.

Group scripts by purpose: development/build/start, type/lint/test checks, formatting, then commit hooks and delivery commands. Preserve command values and leave dependency entries and conditional export maps in their existing order. In particular, do not move a `default` export condition ahead of more specific conditions. The layout cleanup in [P00-23](TASKS.md) changes no versions, package relationships or runtime behavior.

The safety fixtures test these cases with the real ESLint engine. New order-dependent structures need a regression before relaxing the configuration. See [P00-21 verification](evidence/P00-21.md) for completion evidence.

Reference: [commitlint local setup](https://commitlint.js.org/guides/local-setup), [configuration](https://commitlint.js.org/reference/configuration.html).

Rule references: [Perfectionist](https://perfectionist.dev/rules.html), [SonarJS](https://github.com/SonarSource/SonarJS), [unused-imports](https://github.com/sweepline/eslint-plugin-unused-imports), [JSON key ordering](https://ota-meshi.github.io/eslint-plugin-jsonc/rules/sort-keys.html), [TypeScript naming](https://typescript-eslint.io/rules/naming-convention/).
