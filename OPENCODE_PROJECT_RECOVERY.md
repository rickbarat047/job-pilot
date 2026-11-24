# JobPilot AI — OpenCode Project Recovery

Recovery baseline created after OS reinstall / fresh OpenCode install. All statements below are
marked **Verified** (directly inspected or command output in this session) or **Assumption**
(inferred; not confirmed). Secrets are never recorded here.

## A. Project overview

**Verified.** JobPilot AI is a premium AI-assisted career platform for job seekers in India.
Next.js 16.4.3 App Router (React 19, TypeScript, Tailwind 4, Turbopack), custom auth (scrypt +
opaque session tokens in HttpOnly cookies), dual database provider (SQLite via `node:sqlite`
locally; PostgreSQL via `pg` + `DATABASE_URL` in production), Supabase Storage for documents,
DeepSeek-compatible AI provider (`AI_API_KEY`), GitHub Actions for CI/scheduling/browser worker,
and Vercel deployment. A Python Playwright worker (`worker/automation.py`) plus a Node worker
(`scripts/browser-worker.mjs`) handle automation. Applications are approval-first.

Verified routes include landing, `/login`, `/register`, `/onboarding`, `/dashboard`, `/jobs`,
`/applications`, `/companies`, `/interviews`, `/automation`, `/profile`, `/cv-builder`,
`/settings`, `/mobile-home`, `/admin/users`, and ~55 `/api/*` handlers.

**Verified product direction:** premium, minimal, professional emerald/green identity;
`DESIGN_SYSTEM.md`, `REDESIGN_PLAN.md`, `DESIGN_AUDIT.md` are the design references.

## B. Previous developer's instructions — handoff discovery

**Verified — there is no single file named `CODEX.md`, `HANDOFF.md`, `CLAUDE.md`, or
`GEMINI.md`, and no such filename in Git history (all branches, including `recovery/main`).
A recursive search for "Codex/OpenCode/handoff" found no dedicated handoff file.** The handoff
is a *chain of recovery documents* left by successive agents:

| File (all Verified) | Role in handoff |
|---|---|
| `docs/RECOVERY_PROGRESS.md` | Baseline + browser-worker recovery history + DB Batch 1 summary |
| `docs/RECOVERY_AUDIT.md` | Repository audit: issues **JP-001…JP-014**, health score 72/100, fixes JP-005 → JP-006 → JP-002 → JP-003 → JP-007 |
| `docs/DB_AUTH_AUDIT.md` | Database/auth audit: issues **DB-001…DB-012**, "Exact recovery sequence" (section 17) |
| `docs/DB_RECOVERY_PROGRESS.md` | DB Batch 1 implementation record (DB-001/002/007/008/012) |
| `docs/DB_BATCH1_CODE_REVIEW.md` | Review of Batch 1 |
| `docs/DB_BATCH1_DEPLOYMENT_PREFLIGHT.md`, `docs/DB_BATCH1_PRODUCTION_PREFLIGHT.md` | Read-only production preflight; manual Q1–Q10 SQL + migration CLI steps |
| `docs/PUSH_SUBSCRIPTIONS_SECURITY_REVIEW.md`, `docs/PUSH_SUBSCRIPTIONS_RLS_PROGRESS.md` | Design of migration `0004` (default-deny RLS, no `auth.uid()`) |
| `docs/DB_BATCH1_FINAL_APPROVAL.md` | **Latest/most complete handoff.** Verdict: "READY FOR STAGING, BLOCKED FOR PRODUCTION"; 7 ordered manual next steps; ends with **STOP** |
| `TODO.md` | Feature status (39 completed items); notes 4 items blocked on user credentials |

**Exact instructions from the latest handoff (Verified, `DB_BATCH1_FINAL_APPROVAL.md` §5):**
run read-only role/RLS/grant SQL against production; confirm DB + Storage backup; verify
`supabase migration list --remote`; `supabase db push --remote --dry-run`; apply `0003` + `0004`;
post-migration read-only verification; commit/push/deploy per preflight plan. **No production changes
were made by the previous agent, and it explicitly stopped awaiting production evidence/approval.**

**Verified — the earlier `RECOVERY_AUDIT.md` prescribes the repair order** JP-005 → JP-006 →
JP-002 → JP-003 → JP-007, then E2E verification with a dedicated test account.

## C. Current implementation status

### Completed (Verified in code)
- Auth, sessions, permissions/autonomy, CV upload + OCR, matching, tailoring, documents.
- Production hardening in commits `f931c45` / `a6689a5`: login `assertSameOrigin`, missing-Origin
  rejection, Upstash distributed rate limiting, `src/middleware.ts`, SSRF protections (`src/lib/sources/http.ts`).
  **This supersedes stale audit claims DB-004, DB-005, DB-009, DB-010.**
- Uncommitted working-tree changes (must not be discarded): `src/lib/db.ts` (`resolveProvider()`
  fail-closed; placeholder-aware `toPgPlaceholders()` = JP-002/DB-006), `src/lib/storage.ts`
  (`resolveStorageProvider()` fail-closed + traversal fix = DB-012), `src/lib/bootstrap.ts`
  (no duplicate `push_subscriptions`), `scripts/setup-supabase.js` (no `DROP SCHEMA` = JP-005/DB-008),
  `docs/RECOVERY_PROGRESS.md`.
- New migrations `supabase/migrations/0003_push_subscriptions.sql` and
  `0004_push_subscriptions_rls.sql` (committed at `c0785ef`), with static tests.
- New config tests: `db-config.test.ts`, `storage-config.test.ts`, `schema-consistency.test.ts`,
  `push-subscriptions-rls.test.ts`. The audit recommended runtime tests that `getSqlite()` applies
  the full schema and that bootstrap is idempotent are **not** present (Verified by file list).

### Partially completed / blocked on the operator (Verified)
- Production migration `0003`/`0004` **not applied**; production DB role compatibility, backup,
  and migration history **UNVERIFIED**. This needs credentials/manual access; cannot be done here.
- E2E journeys A–J in `RECOVERY_AUDIT.md` §6 were never executed — no dedicated test account.

### Genuinely still open (Verified by reading current code)
- **JP-003 — FIXED this session.** `src/app/api/health/route.ts` now probes frontend, database,
  authentication, storage, AI, worker and email config, derives `status: ok|degraded|error`,
  returns 503 only for a dead database, and logs the real status. Runtime check confirmed:
  HTTP 200, `{"status":"degraded","database":"ok","worker":"offline",...}`.
- **JP-001 / JP-008 — FIXED by remote PR #2** (merged `6c94643`, integrated into this push):
  `package.json` now uses `eslint src` with `eslint.config.mjs`; CI now runs lint + build.
  Verified locally: `npm run lint` exit 0 (0 errors, 26 pre-existing warnings), build PASS.
- **JP-004/JP-014** `src/lib/ai/tailor.ts`, `src/app/api/profile/ai-assist-cv/route.ts`: silent
  deterministic fallback; swallowed AI errors (`catch {}`).
- **DB-011** `src/lib/rate-limit.ts` `clientIp()` trusts `x-real-ip`/last `x-forwarded-for` entry.
- **DB-003** broad `0002_rls.sql` `auth.uid()` mismatch is documented, not fixed (architectural).
- Next.js 16.4.3 reported a security advisory on first `npm run build` (framework asks for a
  `next upgrade --agent=security`); retry build succeeds. No upgrade performed.

## D. Current technical condition (baseline, this session)

- `node v26.13.1`; `npm 11.20.0`; `node_modules` was **missing** after the OS reinstall;
  installed with `npm ci` from `package-lock.json` (287 packages). PowerShell `npm.ps1` is blocked
  by execution policy; commands were run with `Set-ExecutionPolicy -Scope Process Bypass`.
- `npm run typecheck`: **PASS** (0 errors).
- `npm test`: **PASS** — 21 files, 118 passed, 3 skipped (the 3 `it.skip` PG runtime tests).
- `npm run build`: **PASS on retry** (first run stopped by the Next.js security nudge; second
  run exit 0). Non-fatal warnings: `pdfjs-dist` ESM externalization; dynamic-filesystem tracing
  in `db.ts`/`storage.ts`; `middleware` convention deprecated in favor of `proxy`.
- `npm run lint`: **FAIL** (JP-001).
- Git: branch `main` at `c0785ef`, tracking `origin/main`. Also local `recovery/main` at `633ba31`.
  Uncommitted user work preserved (5 modified files); untracked audit/recovery docs and 4 test files.
- `.env` exists locally with all application secrets; names only were inspected. `DATABASE_URL`
  is absent locally → SQLite dev mode (expected). Required production vars per docs:
  `DATABASE_URL`, `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `AI_API_KEY`, `CRON_SECRET`, `WORKER_TOKEN`, `APP_URL`, Upstash rate-limit vars, VAPID keys.

## E. Important files

- `src/lib/db.ts`, `src/lib/storage.ts`, `src/lib/bootstrap.ts`, `src/lib/schema.ts` — providers/schema.
- `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/rate-limit.ts` — auth/security boundary.
- `src/app/api/health/route.ts` — monitoring endpoint (next task).
- `supabase/migrations/0001…0004*.sql` — authoritative production schema/RLS.
- `docs/RECOVERY_AUDIT.md` (JP list), `docs/DB_AUTH_AUDIT.md` (DB list),
  `docs/DB_BATCH1_FINAL_APPROVAL.md` (latest handoff), `TODO.md`, `DESIGN_SYSTEM.md`.
- `.github/workflows/{ci,health-check,worker,browser-worker,backup}.yml`.

## F. Next steps (priority order)

1. **JP-003 — DONE.** Component statuses + honest overall status + 11 new tests + runtime check.
2. **JP-001 + JP-008 — DONE** by remote PR #2 (ESLint config + CI build step); verified locally.
3. **JP-004/JP-014** — surface deterministic AI fallback in UI/API, log swallowed errors. *(next task)*
4. **DB-011** — validate/derive client IP instead of trusting spoofable headers.
5. **Operator-only (blocked here)** — production read-only checks, backup verification,
   apply migrations 0003/0004, commit/push/deploy per `DB_BATCH1_FINAL_APPROVAL.md`, then E2E A–J.
6. **DB-003** — architectural decision: keep documented app-level isolation or adopt Supabase Auth.

## G. Important constraints

- Do not reset/clean/revert/overwrite existing work; preserve uncommitted Batch 1 changes.
- Do not run migrations, modify production data, commit, push, or deploy without explicit approval.
- Never print secrets; report env **names** only.
- Preserve architecture, routes, auth, design system (emerald/premium), approval-first automation.
- Never fabricate qualifications, listings, match scores, or application submissions.
- `AGENTS.md`: read `node_modules/next/dist/docs/` before writing Next.js code (done: Route Handlers guide).

## H. Change log

- 2026-11-21: Created this recovery document; installed dependencies; established baseline;
  verified handoff chain; no application source files changed yet.
- 2026-11-21 — Phase A (JP-003): modified `src/app/api/health/route.ts`; restored tracked
  `src/app/api/health/route.test.ts` (accidentally overwritten, then recovered via git) and
  updated its assertion to the new contract; added `src/app/api/health/route.degraded.test.ts`
  (11 tests). Verified: typecheck PASS; health tests 12/12; full suite 129 passed / 3 skipped
  (was 118/3); `npm run build` PASS; live GET /api/health HTTP 200 with degraded status and
  database ok. No commit/push/deploy; prior uncommitted work preserved.
  **Exact next task at that point:** JP-001 (broken `next lint`) + JP-008 (no build step in `ci.yml`).
- 2026-11-21 — GitHub push: created commits `36b03f7` (DB Batch 1) and `9fd30a7` (recovery +
  JP-003). Initial push was rejected because remote `main` had advanced via PR #2; fetched,
  merged `origin/main` (`04bedbd`, resolving the `db.ts` conflict in favor of
  `resolveProvider()`), and pushed successfully. Verified merged tree: typecheck PASS,
  lint exit 0 (0 errors / 26 warnings), 129 tests passed / 3 skipped, build PASS.
  A final documentation commit `c9052d2` was then pushed; verified local `HEAD` ==
  `origin/main` == `c9052d2`, working tree clean at that point.
- 2026-11-22 — Browser worker investigation and fix (user request: "i checked on github it says
  the browser worker is not working ..can you fix it for me please"). Root cause confirmed from
  GitHub/Vercel evidence: the `WORKER_TOKEN` was rotated on 2026-11-14 at 10:13Z in both GitHub
  Actions and Vercel, but the live Vercel deployment was built at 08:29Z with the OLD value, so
  runs #43–#69 failed with `401 Invalid worker token.`. Our Nov 21 deployments picked up the
  rotated env var and run #70 succeeded, so the red streak is already resolved. Two remaining
  product issues fixed in code (user chose "Fix both"): (1) any failed task/result-post is now a
  real CI failure and an empty queue is logged explicitly; (2) one-shot scheduled runs no longer
  post an offline heartbeat, and `workerIsOnline()` now uses a configurable 12h window
  (`WORKER_ONLINE_WINDOW_MS`) instead of 90 seconds, so browser apply is not paused between
  GitHub's throttled 4–8h runs. Files: `scripts/browser-worker-lib.mjs`,
  `scripts/browser-worker.mjs`, `src/lib/automation.ts`,
  `src/lib/browser-worker.test.ts`, new `src/lib/automation.worker-online.test.ts`.
  Verified TDD red→green; `npm test` 139 passed / 3 skipped (23 files); typecheck PASS; lint
  0 errors / 26 pre-existing warnings; build PASS on retry (Next.js security nudge). No commit,
  push, deploy, secret change, or production data change made for this fix.
- 2026-11-24 — Next.js security upgrade (user: "no need to run in a separate worktree..use the
  current one please..and when done please make sure all changes gets applied on the live site
  and github also"). Duplicate checks: no equivalent local/remote branch or open PR (only PR #1,
  Vercel Analytics). Upgraded `next` 16.4.3 → **16.4.6** (`package.json`, `package-lock.json`)
  using the exact security-target version, and set `experimental.agentUpgrade: "security"` in
  `next.config.ts`. Verified with Node 26.13.1: `next --version` 16.4.6; typecheck PASS;
  139 tests passed / 3 skipped; lint 0 errors / 26 pre-existing warnings; build PASS with no
  security nudge. Telemetry `report-agent-upgrade ... success` submitted.
  **Exact next task:** JP-004/JP-014 (honest AI fallback UI + error logging), then DB-011
  (spoofable client IP). Operator-only production migration steps remain in
  `docs/DB_BATCH1_FINAL_APPROVAL.md`.
