---
description: Resume JobPilot from its latest verified checkpoint and continue toward a reliable candidate journey
agent: build
---

Continue the JobPilot project from the latest verified state. Treat “continue” as an instruction to do the next useful work, not to provide only a status summary or another plan.

Start by reading `AGENTS.md`, `TODO.md`, and `.opencode/JOBPILOT_CONTINUATION.md`. Verify the actual checkout, branch, working tree, recent commits, and current tests before relying on checkpoint claims. Preserve uncommitted work; inspect it and continue from it instead of overwriting or reverting it.

The objective is a useful, trustworthy candidate journey: current and relevant jobs, truthful candidate-specific application materials, clear consent and approval, and dependable application tracking. Do not claim JobPilot guarantees interviews or employment.

Work autonomously through the highest-priority incomplete candidate-facing requirement. For each non-trivial change, establish acceptance criteria, inspect the relevant code and tests, implement the smallest complete improvement, and verify it with focused tests plus applicable project checks. Do not stop after writing a plan or after finding a blocker if another safe part of the objective can still move forward.

When a work unit is verified, update `.opencode/JOBPILOT_CONTINUATION.md` with the resulting commit or diff state, checks and exact outcomes, remaining blockers, and the next concrete action. Never record credential values or private candidate data in the checkpoint.

## Release and data boundaries

- The user requested that working changes be pushed to the existing feature branch. Preserve history; never force-push or push directly to `main`. If GitHub authentication or network access prevents a push, keep the verified local commit and record the specific failure so the next session can retry.
- The current instruction is to keep production restrictions. Do not alter production schema/data, apply migrations, change hosted environment variables, weaken SSO/deployment protection, or deploy/promote to production. A production migration requires an outside-repository backup verified with `pg_restore --list` first.
- Do not read, print, copy, or log secrets. Do not reuse any credential previously shared in chat; treat it as compromised and advise rotation without repeating it.
- Keep SSO enabled. Use authenticated dashboard access only after the user signs in directly. Do not try to bypass login or protection.

Finish each turn with the work actually completed, evidence, push/deployment state, any genuine user action required, and the next checkpoint. Continue with that next action whenever the user says `continue`.
