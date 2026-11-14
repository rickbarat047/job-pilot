---
description: Plan a JobPilot change against the current code and readiness gates
agent: plan
---

Plan this JobPilot task: $ARGUMENTS

Read `AGENTS.md`, the current `TODO.md`, and the relevant implementation and tests. Inspect the current branch and working tree. Return:

1. The candidate outcome and acceptance criteria.
2. Evidence about the current implementation, with file paths.
3. An ordered, scoped implementation plan.
4. The focused and full verification commands that fit the change.
5. Any production-data, credential, migration, or deployment boundary that the plan must respect.

Stay in Plan mode: do not edit application files, run mutating commands, or claim outcomes that have not been verified. Do not ask for approval for ordinary reversible code changes; identify actions that are explicitly outside the project's current authorization.
