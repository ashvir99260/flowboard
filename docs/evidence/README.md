# Verification Evidence

This directory records what each task actually demonstrated. Use one short Markdown record per task, named with its stable ID, such as `P00-01.md`. Use the [template](../TASK_TEMPLATE.md), [workflow](../DEVELOPMENT_WORKFLOW.md) and [gate catalogue](../QUALITY_GATES.md).

An evidence record belongs to the same Git commit as the task it verifies. Resolve that commit through Git history; do not put an impossible self-hash into the file. Follow-up fixes may append dated verification to the record. Do not erase an old failed observation to imply it never happened.

Record tests by real path/name, commands by their actual invocation, outcomes as pass/fail/not_run/not_applicable and relevant prerequisites. Include just enough output to explain the result. Do not commit tokens, passwords, cookie jars, raw DB exports or sensitive task data.

Requirement status is maintained in [REQUIREMENTS_MATRIX.md](../REQUIREMENTS_MATRIX.md). Evidence must cover the row's entire acceptance before it becomes verified. The original planning task P-000 predates this directory; its original evidence is preserved in [TASKS.md](../TASKS.md) and commit `7d7fe01`. Do not invent retrospective test output for it.

P00-01 supplies workspace build/lint/typecheck/format checks and native configuration tests. Feature tests are recorded with their owning tasks. A complete documentation task demonstrates document structure and scope, not functioning application behavior.
