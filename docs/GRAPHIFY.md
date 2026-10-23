# Local Graphify code navigation

Graphify is optional developer tooling for mapping code relationships. It is separate from the application stack, pnpm builds and CI. The verified CLI version is **graphifyy 0.4.23**; the command is named `graphify`. This machine already has it installed. Configuration and these instructions are committed; generated data is not.

From the repository root:

```sh
graphify update .
graphify query "Which modules handle release publication?" --budget 1500 --graph graphify-out/graph.json
graphify explain "deployReleasedApps" --graph graphify-out/graph.json
```

Read `graphify-out/GRAPH_REPORT.md` for an overview and open `graphify-out/graph.html` locally for the interactive graph. `update` creates the initial index and reuses per-file extraction caches on later runs. Keep the cache between sessions. Refresh after structural code changes; an older graph may contain outdated relationships. Large graphs may skip HTML generation, so check the report and JSON independently.

If a future semantic run adds document/media nodes, native code updates preserve them without refreshing them. Treat their claims as stale until separately refreshed.

On another machine, use Python 3.10+ and an isolated installation of the official `graphifyy==0.4.23` package. For example, if `uv` is already available, `uvx --from graphifyy==0.4.23 graphify update .` runs that version without adding a runtime dependency to Flowboard. Use the same prefix for queries. Installation is a local developer choice; the repository does not install global packages or hooks automatically.

## What is indexed

The default command performs local deterministic AST extraction of supported code, including authored app/package source and tests. It does not call a remote model or perform semantic extraction of architecture documents, PDFs or media. `.graphifyignore` excludes dependencies, build outputs, generated API-client code, environment files and local tooling state. Markdown remains authoritative documentation, but is not semantically indexed by this code-only command.

This is a navigation aid, not a whole-system dependency proof. Runtime wiring, dependency injection, generated clients and reflection may not appear as static edges. Check the current source before changing code. Do not infer correctness, permission safety, test coverage or performance from centrality scores or graph labels. Do not paste the full JSON into a model; use focused queries with a token budget.

## Local data and Git

`graphify-out/` contains generated JSON, HTML, reports, manifest, extraction caches and optional saved query memory. `.graphify_*` files are intermediate extraction state. Both are ignored at every workspace depth by Git, Docker contexts and formatting. Never force-add them, attach them to a PR or upload them as CI artifacts. `.graphifyignore` and this guide remain tracked.

Keep any optional exports, saved answers or future ingestion under `graphify-out/` too. Plain `graphify add` writes to `raw/`; if ingestion is separately requested, explicitly use `--dir graphify-out/raw` so downloaded/generated data stays local.

```sh
git check-ignore graphify-out/graph.json graphify-out/GRAPH_REPORT.md
git ls-files -- 'graphify-out/**' '**/graphify-out/**' '.graphify_*' '**/.graphify_*'
```

The first command should list ignored paths; the second should produce no output. Ignore rules cannot untrack files already committed, so verify both. Regenerate local outputs after a fresh clone. For questions about architecture, start with the report, query a narrow topic, and inspect the referenced files. Follow [AGENTS.md](../AGENTS.md) for the full development workflow.

Reference: [official Graphify 0.4.23 package and commands](https://pypi.org/project/graphifyy/0.4.23/).
