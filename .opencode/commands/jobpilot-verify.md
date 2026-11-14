---
description: Verify JobPilot changes without touching production
agent: build
---

Verify the current JobPilot work: $ARGUMENTS

Inspect the diff and working tree, map the change to its acceptance criteria, run the focused existing tests and relevant project checks (`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` as applicable), then report exact results and limitations. Never read or print secret values. Do not connect to production, write production data/schema, change hosted environment variables, disable deployment protection, or deploy/promote. Distinguish local checks from preview and production evidence.
