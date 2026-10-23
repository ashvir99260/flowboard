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

See [tasks](TASKS.md) P00-20 for commit checks and P00-21 for the requested shared ESLint expansion. Sorting and naming changes are not active until P00-21 is verified.

Reference: [commitlint local setup](https://commitlint.js.org/guides/local-setup), [configuration](https://commitlint.js.org/reference/configuration.html).
