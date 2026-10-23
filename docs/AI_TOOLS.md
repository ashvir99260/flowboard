# Local tools for AI-assisted coding

These tools help a human or Codex find the right code and verify changes. They do not replace the task plan, source review or existing CI. No new model service, subscription, global hook or autonomous rewrite is required.

| Tool     | Job                                                                           | Setup                                                                       |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Serena   | Find declarations, symbols and references through TypeScript language tooling | Existing connector; repository-local state in ignored `.serena/`            |
| ast-grep | Search code syntax without confusing comments or strings with real calls      | Root development dependency pinned to `0.51.0`; installed by `pnpm install` |
| Gitleaks | Check local files for likely secrets before sharing changes                   | Optional native CLI; verified with the installed `8.30.0`                   |
| Graphify | Navigate a cached map of code relationships                                   | Existing optional tool; see [Graphify guide](GRAPHIFY.md)                   |

## Serena: inspect symbols before editing

Activate this repository in the connected Serena tool. Its local `.serena/project.yml` should contain `language_servers: [typescript]` for both TypeScript and JavaScript. Preserve other existing settings. No global configuration change is needed.

Use `get_symbols_overview` on a specific file, `find_symbol` for a declaration, and `find_referencing_symbols` before changing a shared interface. Read relevant source and tests before editing. Local onboarding memories contain pointers to the canonical documents, not replacement requirements.

If an already-running connector cached an empty language-server list, reconnect it after changing the project file. A fresh local process can verify the configuration independently:

```sh
serena project index-file packages/release-tools/src/deploy.ts .
serena memories check .
```

The existing local connector may require that reconnect; successful CLI indexing does not prove the old server has reloaded. The `.serena/` configuration, indexes and memories stay local and can be recreated after cloning.

## ast-grep: search syntax

Run from the repository root. Always use the full `ast-grep` name; `sg` is an unrelated command on some Linux systems.

```sh
pnpm exec ast-grep --version
pnpm exec ast-grep run --lang ts --pattern 'await $OBJ.$METHOD($$$ARGS)' packages/release-tools/src
pnpm exec ast-grep run --lang tsx --pattern 'useState($$$ARGS)' apps/web packages/ui
```

These are read-only searches. Do not add `--rewrite` or `--update-all` during discovery. Use narrow paths and inspect matches before making task-scoped changes. The native platform binary comes from the same pinned official npm release; only its reviewed install hook is allowed by the workspace policy.

## Gitleaks: check before sharing

Run the native CLI locally with the repository config. No API key or paid service is used. On another machine, install the official CLI separately; it is not an application dependency or an automatic CI requirement.

```sh
mkdir -p .ai-local
gitleaks version
gitleaks dir . --config .gitleaks.toml --redact=100 --log-level=info --no-banner --no-color --ignore-gitleaks-allow --exit-code=23 --timeout 90 --report-format json --report-path .ai-local/gitleaks.json
```

Exit `0` means no findings for the scanned files; exit `23` means findings need investigation. Any other status is a tool failure, not a clean result. The explicit findings code distinguishes detections from errors. This scans current files, including untracked files, not Git history. `.gitleaks.toml` extends the built-in rules and excludes dependency/build/tool output only; `.env` files and authored code remain scannable. Gitleaks does not use `.gitignore` as its exclusion policy.

Keep logs and reports local. Redaction masks detected secrets, but metadata can still contain sensitive context, so do not post full reports. Summarize rule, path and line only. Do not use verbose or trace logging, suppress findings automatically, or add blanket baselines to make a scan pass. If a real secret is found, revoke/rotate it and remove the exposure before sharing changes; a clean current-file scan does not prove old history is clean.

## Shared workflow and local data

1. Read the current task, decisions and evidence.
2. Use Graphify or Serena to narrow the relevant source; use ast-grep for code patterns.
3. Implement the smallest verified change and run the required build/lint/type/test checks.
4. Run Gitleaks before sharing, then review the Git diff. No scanner result grants authority to change scope or publish data.

Keep optional reports under `.ai-local/`, Graphify output under `graphify-out/`, and Serena state under `.serena/`. These are Git-ignored and excluded from image contexts and formatting. The committed tool configuration and this guide remain visible.

References: [ast-grep CLI](https://ast-grep.github.io/reference/cli), [Gitleaks usage and configuration](https://github.com/gitleaks/gitleaks), [Serena project configuration](https://oraios.github.io/serena/02-usage/020_running.html).
