<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# JobPilot project workflow

## How to work

- For every non-trivial task, first inspect the current branch, working tree, relevant code, tests, and the matching project docs. State the user outcome, acceptance criteria, and a short ordered plan before editing. For routine, reversible code changes, continue through implementation and verification in the same task; do not stop after presenting a plan.
- If the user says “continue” or “resume,” read `.opencode/JOBPILOT_CONTINUATION.md`, revalidate it against the actual checkout, and carry out its next concrete action. Do not return only a recap or another plan. The same workflow is available as the OpenCode `/continue` command.
- Keep changes tied to the actual candidate journey: relevant and current jobs, honest candidate-specific materials, understandable consent and approvals, and dependable application tracking. Do not claim that JobPilot guarantees interviews or employment.
- Prefer the smallest complete fix that meets the acceptance criteria. Add or update focused regression tests for confirmed defects; then run the existing full suite and static checks when the change warrants them.
- Finish with evidence: summarize what changed, tests/checks and outcomes, current branch/commit, whether the change was pushed, and whether a preview or production deployment was actually verified. Never report an action as complete based only on intent.

## Project map and checks

- Next.js App Router routes and screens live under `src/app`; shared product and server logic lives under `src/lib` and `src/components`.
- Job sources are implemented under `src/lib/sources`; matching and discovery are in `src/lib/matching.ts` and `src/lib/discovery.ts`; application state transitions are in `src/app/api/applications` and related `src/lib` modules.
- Database schema changes are versioned under `supabase/migrations`. Check the current readiness notes in `TODO.md` and backup guidance in `BACKUP.md` before proposing any operational change.
- Existing checks: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Run a focused test first for a narrow fix, then the full suite before shipping. Report pre-existing lint warnings and environment-specific build failures accurately.

## Data, credentials, and release boundaries

- Never read, print, copy, or commit `.env` files, database URLs, passwords, tokens, or other secrets. Do not place secrets in prompts, logs, shell history, or generated plans.
- Never seed, mutate, migrate, or otherwise write to production data/schema; never change Vercel environment variables, weaken deployment protection, or deploy/promote to production unless the user explicitly changes the existing production restrictions.
- Do not apply a production migration until the documented backup has been created outside the repository and verified with the appropriate restore-list tool. A health endpoint or a green unit suite is not a substitute for an end-to-end check.
- Browser automation must honor the application’s consent and approval controls. Do not claim an application was submitted unless the destination site confirmed it.
- After the user requests shipping, commit and push tested changes to the current feature branch only. Do not force-push, rewrite history, or push directly to `main`; if credentials or network access fail, keep the commit intact and report the exact blocker.
