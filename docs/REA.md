# Reverse Engineer Anything: local artifact inspection

[REA](https://github.com/morluto/rea) inspects built JavaScript/Electron applications and other software artifacts. Use it when a question depends on the shipped artifact. For normal Flowboard source navigation, start with Serena, ast-grep or Graphify in [AI_TOOLS.md](AI_TOOLS.md).

## Install the optional CLI

From the repository root, use Node 22.19 or newer in the Node 22 line (the repository's `.nvmrc` is compatible). The official package is pinned to `rea-agents@6.7.0` here. Installation is separate from `pnpm install`, CI and application images.

```sh
mkdir -p .ai-local/rea
npm install --prefix .ai-local/rea --cache .ai-local/rea/npm-cache --no-save --package-lock=false --ignore-scripts --omit=optional --no-audit --no-fund --no-update-notifier rea-agents@6.7.0
```

Static analysis also uses host process-ownership checks: Linux needs `ps`; macOS needs the Xcode command-line tools (`xcrun swiftc`).

This installs the prebuilt CLI without running dependency installation scripts or installing optional Frida instrumentation. Static JavaScript inspection requires neither Frida nor a native decompiler. No global package, agent configuration, account or paid service is needed.

## Keep temporary data local

In the shell used for REA, set these tool-specific paths before running it. Do not change `HOME` or `CODEX_HOME`.

```sh
FLOWBOARD_REA_DIR="$PWD/.ai-local/rea"
mkdir -p "$FLOWBOARD_REA_DIR/tmp" "$FLOWBOARD_REA_DIR/swift-module-cache"
```

Apply the following environment only to the REA command, as shown below. It places Node temporary analysis files and the macOS process-helper module cache under the ignored directory, and disables the CLI's background update notifier. Some operating-system compiler caches are managed separately; these settings do not promise a host-wide sandbox.

```sh
TMPDIR="$FLOWBOARD_REA_DIR/tmp" TMP="$FLOWBOARD_REA_DIR/tmp" TEMP="$FLOWBOARD_REA_DIR/tmp" \
REA_DARWIN_MODULE_CACHE_PATH="$FLOWBOARD_REA_DIR/swift-module-cache" NO_UPDATE_NOTIFIER=1 \
  "$FLOWBOARD_REA_DIR/node_modules/.bin/rea" --version
```

## Inspect our compiled JavaScript

Build Flowboard first with `pnpm build`. Then inspect one small, explicit artifact directory instead of the entire repository:

```sh
TMPDIR="$FLOWBOARD_REA_DIR/tmp" TMP="$FLOWBOARD_REA_DIR/tmp" TEMP="$FLOWBOARD_REA_DIR/tmp" \
REA_DARWIN_MODULE_CACHE_PATH="$FLOWBOARD_REA_DIR/swift-module-cache" NO_UPDATE_NOTIFIER=1 \
  "$FLOWBOARD_REA_DIR/node_modules/.bin/rea" analyze-javascript-application "$PWD/packages/release-tools/dist" --json \
  > "$FLOWBOARD_REA_DIR/release-tools-evidence.json" 2> "$FLOWBOARD_REA_DIR/analysis.stderr"
```

Check the command's exit status before using the result. Missing or unsupported targets and tool failures are not successful analyses. Static analysis reads code; it does not establish runtime behavior or prove every inferred relationship. Check evidence, coverage and limitations against source and tests.

Full evidence can contain source code and become large. Save it locally and request a bounded view rather than pasting the whole file into a chat. REA inventories the entire target directory without using our ignore files, so never point it at the repository root or its own installation directory.

Version 6.7.0 accepts inline evidence inside a JSON input file for this view. Newer upstream documentation may show additional input forms:

```sh
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(".ai-local/rea/view-request.json", JSON.stringify({
  source: { kind: "inline", evidence: JSON.parse(readFileSync(".ai-local/rea/release-tools-evidence.json", "utf8")) },
  view: { kind: "summary" }
}));'
TMPDIR="$FLOWBOARD_REA_DIR/tmp" TMP="$FLOWBOARD_REA_DIR/tmp" TEMP="$FLOWBOARD_REA_DIR/tmp" \
REA_DARWIN_MODULE_CACHE_PATH="$FLOWBOARD_REA_DIR/swift-module-cache" NO_UPDATE_NOTIFIER=1 \
  "$FLOWBOARD_REA_DIR/node_modules/.bin/rea" inspect-analysis-view "$FLOWBOARD_REA_DIR/view-request.json" --json \
  > "$FLOWBOARD_REA_DIR/release-tools-summary.json" 2> "$FLOWBOARD_REA_DIR/summary.stderr"
```

The same command supports explicit module pages. Consult the installed command's `--help` and `--schema` together with the [official CLI guide](https://github.com/morluto/rea/blob/main/docs/cli.md) before changing the request shape. If sandbox process-table restrictions produce `cleanup_incomplete`, treat the run as failed, inspect the named worker and use the host permission flow before retrying; partial evidence is not a successful result.

## Scope and agent connection

Codex can invoke this local CLI when a task calls for artifact analysis. The CLI and MCP expose the same analysis workflows, but this repository does not register a live MCP server. `rea mcp` is the upstream stdio entry point; running it alone does not connect it to Codex. Upstream `rea setup` changes personal agent configuration and installs workflow instructions, so it is outside this repository-local setup.

Use explicit targets provided for the task. Native decompilation, browser capture, attaching to a process and launching a target require their own prerequisites and task scope; this setup does not enable them. Do not run a target or install analysis engines merely to inspect a JavaScript artifact.

Keep the CLI installation, npm cache, temporary files, evidence, exports and summaries under `.ai-local/rea/`. Existing Git, Docker, formatting, Graphify and Gitleaks exclusions cover that directory. Never force-add it or upload it as a CI artifact. The tracked guide and tests are the shared integration; contributors can reproduce the optional local install from the pinned command above.

References: [official project](https://github.com/morluto/rea), [installation and client setup](https://github.com/morluto/rea/blob/main/docs/installation.md), [CLI and evidence](https://github.com/morluto/rea/blob/main/docs/cli.md).
