# Task and Evidence Templates

These are reusable documentation templates, not unfinished application implementations. Replace bracketed fields when writing a real task/evidence record. Do not leave unfilled template text in a completed task.

## Task entry

```markdown
- [ ] **<task-id> — <small independently verifiable outcome>**
  - **Goal:** <observable behavior and why it is needed>.
  - **Requirements:** <stable IDs from REQUIREMENTS_MATRIX.md>.
  - **Files:** <planned created/modified/test paths>.
  - **Dependencies:** <earlier task IDs or None>.
  - **Acceptance:** <specific behavior, boundaries, failure and recovery expectations>.
  - **Validation:** <commands plus public-seam tests; applicable gate IDs>.
  - **Commit:** `<type>: <focused message>`.
  - **Completion evidence:** <relative link to docs/evidence/task-id.md; fill after verification>.
```

For a broad requirement, several small tasks may reference the same requirement ID. Never split tasks into an unsafe public endpoint first and its authorization/validation later.

## Work contract before editing

```markdown
Task: <task-id and title>
Requirements: <IDs and short outcomes>
Inputs: <existing interfaces/schemas and dependencies>
Outputs: <new/changed interfaces and paths>
Scope: <small intended diff; note unrelated changes to preserve>
Failure cases: <observable incorrect/forbidden/concurrent inputs>
Gates: <Gxx IDs and actual available commands>
Decision: <existing decision ID or newly recorded narrow default>
```

This may be the opening section of the task's evidence record. It does not need to become a separate planning document or require a new user approval.

## Evidence record

```markdown
# <task-id> <title>

Date: <date>
State: <in_progress | incomplete | complete>
Requirements: <IDs>
Scope: <behavior and files>
Commit: This record is included in the task commit; resolve it through Git history.

## Acceptance evidence

| Criterion | Check or test | Outcome | Observed result |
|---|---|---|---|
| <specific criterion> | <test path/name or documented inspection> | <pass/fail/not_run/not_applicable> | <facts> |

## Verification

| Gate | Command or inspection | Outcome | Environment and observed result |
|---|---|---|---|
| <Gxx> | <exact command> | <outcome> | <exit result/count; required services; no secrets> |

## Review

<What was reviewed, issues found and their fixes; independent review when used.>

## Decisions and limitations

<Decision IDs, unavailable checks and remaining work. Use None only when checked.>

## Handoff

<Next task and any relevant context that is not already clear from code/docs.>
```

## Three-line user update

```text
Completed <task-id>: <observable result>.
Verified: <actual checks>; <relevant limitations>.
Next: <task-id or concrete blocker>.
```

## Rules for using these templates

- Evidence is concise and factual. Avoid dumping tool logs or repeating the implementation plan.
- A screenshot proves visible layout, not authorization. A unit test proves its inputs, not real database isolation. Match evidence to the property claimed.
- A successful build does not prove requirements are met. A requirement changes to verified only after its own acceptance evidence exists.
- If work stops mid-task, preserve its partial state and next step. Do not tick the task because files were created.
- The task commit may include this evidence record before its hash exists. Git history provides its identity; do not amend just to insert a self-referential hash.
