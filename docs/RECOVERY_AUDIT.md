# JobPilot AI — Recovery Audit Report

Generated: repository-specific audit addendum pass.
Branch audited: `main` at `78add27` (working tree clean; `recovery/main` created for recovery work).

> Note: An earlier recovery directive assumed `docs/RECOVERY_AUDIT.md` already existed. It did not. This file is the first creation of that report, built from the repository-specific audit addendum. All findings below are from static inspection and command execution. No application code was modified during this audit.

---

## 1. Executive summary

JobPilot AI is a Next.js 16.4.3 application with a dual database provider (SQLite locally, PostgreSQL in production via `DATABASE_URL`), Supabase-backed storage in production, a DeepSeek-compatible AI provider, GitHub Actions-based scheduling/browser automation, and a Vercel deployment. The core build, type check, and unit tests pass. The most significant verified issues are tooling (lint is broken under Next.js 16), a SQL-placeholder transformation that can corrupt queries containing `?` in string literals, a health check that over-reports success, a destructive Supabase setup script, silent AI fallback, and a credential leak in the dev seed endpoint response. End-to-end user journeys were not executed (no separate test account was available), so runtime workflow claims remain unverified.

Overall health score: **72 / 100** (methodology in section 12).

---

## 2. Lint and build

### Commands executed

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS — 0 errors |
| `npm test` (`vitest run`) | PASS — 8 test files, 32 tests |
| `npm run build` (`next build`) | PASS — exit 0; routes include `/mobile-home`, `/api/*` |
| `npm run lint` (`next lint`) | **FAIL** — `Invalid project directory provided, no such directory: C:\job ai\lint` |

### Findings

- **JP-001 — Lint command is invalid under Next.js 16.** Severity: MEDIUM.
  - File: `package.json` (scripts.lint).
  - Actual: `next lint` was removed in Next.js 16; the CLI now interprets `lint` as a project directory argument and fails.
  - Expected: a working lint command (e.g. direct `eslint` invocation with a flat config).
  - Root cause: Next.js 16 dropped `next lint`; the project still references it and has no `eslint` dependency or config file.
  - Production impact: CI cannot lint; `ci.yml` runs only typecheck + tests, so lint regressions are never caught.
  - Recommended repair: add `eslint` (+ flat config) as devDependency, or replace with Biome; update `ci.yml`.
  - Verification: `npm run lint` exits 0 on a clean tree.

- **JP-008 — CI does not run the production build.** Severity: LOW.
  - File: `.github/workflows/ci.yml`.
  - Actual: CI runs `npm ci`, `npm run typecheck`, `npm test` only.
  - Expected: also `npm run build` to catch build-time regressions (e.g. route conflicts, missing modules).
  - Root cause: build step omitted.
  - Verification: CI job succeeds including build.

---

## 3. Database and storage

### Provider determination

- Local (`.env`): `DATABASE_URL`/`POSTGRES_URL` absent → provider = `sqlite` (`DATABASE_PATH` defaults to `./data/jobpilot.db`).
- Production (Vercel env): `DATABASE_URL` is set (Hidden) → provider = `postgres`. `DATABASE_PATH` and `STORAGE_DIR` are also set but ignored when `DATABASE_URL` is present.
- Storage: Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise local filesystem. Production has both Supabase vars → Supabase storage. Local has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Supabase storage locally too.

### Findings

- **JP-002 — `toPgPlaceholders` replaces every `?`, including inside SQL string literals.** Severity: MEDIUM.
  - File: `src/lib/db.ts`, function `toPgPlaceholders` (line ~48).
  - Actual: `sql.replace(/\?/g, ...)` converts all `?` characters to `$n`. Any query containing a `?` inside a quoted string literal would be corrupted on Postgres.
  - Expected: only placeholder `?` tokens outside string literals are converted.
  - Root cause: naive global regex.
  - Production impact: latent; current queries appear not to contain `?` in literals, but any future query with one (e.g. `LIKE '%?%'`) would break on Postgres only.
  - Recommended repair: a placeholder-aware converter or parameterized query builder.
  - Verification: unit tests with SQL containing `?` in literals pass on both providers.

- **JP-005 — Supabase setup script is destructive.** Severity: HIGH.
  - File: `scripts/setup-supabase.js`, line 16.
  - Actual: `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; ...` wipes all data before applying migrations.
  - Expected: non-destructive, idempotent migration application.
  - Root cause: setup script designed for fresh provisioning, not for production use.
  - Production impact: running it against production would destroy all user data.
  - Recommended repair: remove the DROP; use `CREATE TABLE IF NOT EXISTS` / additive migrations; require explicit confirmation.
  - Verification: script can be run twice without data loss.

- **JP-006 — Base schema is never applied automatically on Postgres.** Severity: MEDIUM.
  - Files: `src/lib/db.ts` (`getSqlite` applies `SCHEMA_SQL`; `ensureSchema` is a no-op for postgres), `src/lib/bootstrap.ts` (only incremental ALTER/CREATE IF NOT EXISTS for a subset of tables).
  - Actual: On SQLite, `SCHEMA_SQL` creates all tables at connection time. On Postgres, only `bootstrapDatabase()` runs, which assumes base tables already exist and only adds columns/tables for newer features.
  - Expected: equivalent schema initialization on both providers.
  - Root cause: provider-specific bootstrap logic; Postgres relies on out-of-band migration (`supabase/migrations/*.sql`).
  - Production impact: a fresh Postgres database without the migration applied would fail at runtime; the app cannot self-initialize its schema on Postgres. (Production currently works, implying migrations were applied manually.)
  - Recommended repair: make `ensureSchema` apply `SCHEMA_SQL` (adapted for Postgres) or run migrations on startup with a version table.
  - Verification: fresh Postgres instance boots and serves `/api/health` 200.

- **JP-012 — Storage persistence is configuration-dependent.** Severity: MEDIUM (when misconfigured).
  - File: `src/lib/storage.ts`.
  - Actual: Falls back to local filesystem (`./storage`) when Supabase env vars are absent. On Vercel's ephemeral filesystem, uploads and generated documents would be lost between invocations/deployments.
  - Expected: persistent storage in all environments, or a hard failure when unconfigured in production.
  - Root cause: silent fallback.
  - Production impact: Production has Supabase configured, so currently OK. Any environment missing those vars loses files silently.
  - Recommended repair: fail fast (throw) when storage is unconfigured in production; document required vars.
  - Verification: uploading a resume in a Supabase-less environment returns a clear error instead of appearing to succeed.

- **JP-013 — SQLite boolean/JSON/timestamp parity.** Severity: LOW (verified mostly consistent).
  - Cross-database: booleans stored as INTEGER in both schemas; `fromBoolInt` handles both `true` and `1`. JSON stored as JSONB (Postgres) vs TEXT (SQLite); `parseJson` handles both string and object. Timestamps stored as timestamptz (Postgres) vs ISO TEXT (SQLite); comparisons use ISO strings from `nowIso()`. `toBoolInt`/`fromBoolInt` provide conversion.
  - Residual risk: Postgres may return `Date` objects for timestamptz columns depending on `pg` parsing; code treats values as strings in some paths. Not confirmed broken. Mark as UNVERIFIED pending runtime test.

---

## 4. AI provider

- Provider: DeepSeek-compatible (`AI_BASE_URL` default `https://api.deepseek.com/v1`, `AI_MODEL` default `deepseek-chat`), key from `AI_API_KEY`. `isAIEnabled()` = presence of key. Production has `AI_API_KEY` set.
- `chatJSON` validates responses against a Zod schema and throws `AIUnavailableError` on failure/timeout. Timeout via `AbortController`.
- Features using AI: career analysis (`src/lib/ai/tailor.ts`), CV assist (`src/app/api/profile/ai-assist-cv/route.ts`), job tailoring (implied by `jobs/[id]/tailor`). Matching uses deterministic scoring primarily; AI summary optional.

### Findings

- **JP-004 — Silent deterministic fallback without user notice.** Severity: MEDIUM.
  - Files: `src/lib/ai/tailor.ts` (lines 96–98, 127–129), `src/app/api/profile/ai-assist-cv/route.ts` (lines 47–49, 72–74).
  - Actual: When AI is disabled or fails, endpoints return `provider: "deterministic"` but the response is otherwise indistinguishable from a successful AI result; there is no error surfaced and no explicit "AI unavailable" message.
  - Expected: users are clearly informed when real AI is unavailable and whether results are AI-generated or deterministic.
  - Root cause: fallback is designed to be seamless; `provider` field exists but is not enforced as a user-facing signal.
  - Production impact: users may believe AI-generated content is real when it is deterministic; no retry path.
  - Recommended repair: surface `provider` in the UI with a clear badge/message; log fallback reason; optionally retry.
  - Verification: with `AI_API_KEY` unset, UI shows "deterministic (AI unavailable)" and no fake "AI" claim.

- **JP-014 — AI provider errors are caught and swallowed in feature paths.** Severity: LOW.
  - Files: `src/lib/ai/tailor.ts` line 127 (`catch {}`), `src/app/api/profile/ai-assist-cv/route.ts` line 72 (`catch {}`).
  - Actual: errors from `chatJSON` are discarded; no logging of the underlying cause.
  - Expected: errors logged (via `logger`) for diagnosis while still degrading gracefully.
  - Root cause: empty catch blocks.
  - Recommended repair: log the error message; keep graceful fallback.
  - Verification: a failed AI call produces a log entry.

---

## 5. Health check and monitoring

### What each workflow verifies

- `health-check.yml`: polls `${APP_URL}/api/health` every 5 min; passes on HTTP 200 only.
- `worker.yml`: runs `scripts/scheduler.mjs` (cron tick) every 10 min with `CRON_SECRET`.
- `browser-worker.yml`: runs `scripts/browser-worker.mjs` every 10 min with `WORKER_TOKEN`.
- `ci.yml`: typecheck + tests on PR/push to main.
- `backup.yml`: database backup (see `BACKUP.md`).

### Findings

- **JP-003 — Health check over-reports success.** Severity: MEDIUM.
  - File: `src/app/api/health/route.ts`.
  - Actual: Returns HTTP 200 with `status: "ok"` even when the worker is `offline` and when AI is in `fallback` mode. Only DB failure yields 503. The `finally` block logs `ok: true` unconditionally.
  - Expected: separate statuses for frontend, database, authentication, storage, AI, job providers, scheduler, browser worker, and email integrations; overall status reflects degraded components.
  - Root cause: health endpoint aggregates only DB/AI/worker and treats worker/AI degradation as non-fatal without clear signaling.
  - Production impact: monitoring cannot distinguish a fully healthy system from one with offline worker/AI; alerts won't fire for degraded (but up) components.
  - Recommended repair: expand `/api/health` to probe storage, auth (session table), scheduler freshness, browser worker heartbeat, email integration config; return `status: "degraded"` with per-component booleans.
  - Verification: with worker offline, `/api/health` returns `status: "degraded"` and worker field `offline`, while DB stays `ok`.

- **JP-009 — Scheduler/browser-worker health is not verified by any workflow.** Severity: MEDIUM.
  - Files: `.github/workflows/worker.yml`, `.github/workflows/browser-worker.yml`.
  - Actual: Workflows run the scripts but do not verify the resulting application state (e.g. `worker_status.last_heartbeat`, queue depth). A silently failing script still exits 0 in some paths.
  - Expected: post-run verification that heartbeat updated and tasks progressed.
  - Recommended repair: add a follow-up step querying `/api/health` or a status endpoint; fail the workflow on stale heartbeat.
  - Verification: workflow fails when the worker does not update its heartbeat.

---

## 6. End-to-end application testing

**Status: UNVERIFIED.** No separate test account or non-production test data was available during this audit, and the instructions forbid using the owner's personal CV or existing production data. The following journeys were not executed:

A. Registration and login.
B. Resume upload and parsing.
C. Candidate profile extraction and editing.
D. Job discovery from real sources.
E. Job matching based on actual profile.
F. Saving a job.
G. Generating tailored application documents.
H. Application tracking and state updates.
I. Dashboard data persistence after logout/login.
J. User isolation between accounts.

These must be performed with a dedicated test account before early access. The code paths exist (registration, profile, discovery, matching, jobs, applications, interviews, export), but their runtime correctness is unverified by this audit.

---

## 7. Cross-database validation (summary)

- SQL compatibility: queries use `?` placeholders converted to `$n` for Postgres; `LIMIT ? OFFSET ?` etc. work on both. Risk: JP-002.
- Data types: booleans as INTEGER in both; JSON as jsonb (PG) vs TEXT (SQLite) with `parseJson` handling both; timestamps as timestamptz (PG) vs ISO TEXT (SQLite).
- Transactions: both providers implement BEGIN/COMMIT/ROLLBACK via `transaction()`; SQLite uses `BEGIN IMMEDIATE`.
- Constraints: FKs enforced (SQLite enables `PRAGMA foreign_keys = ON`); Postgres enforces by default.
- Duplicate handling: `INSERT ... ` with unique constraints; `INSERT OR ...` SQLite-specific syntax must be checked — grep found `INSERT OR`? Not verified. Mark as needing review.
- User ownership: queries consistently filter by `user_id`; API routes use `requireApiUser()`. Not exhaustively verified.

---

## 8. Confirmed code defects (consolidated)

| ID | Severity | File (line) | Summary |
|---|---|---|---|
| JP-001 | MEDIUM | `package.json` (scripts.lint) | `next lint` invalid under Next.js 16 |
| JP-002 | MEDIUM | `src/lib/db.ts` (~48) | `toPgPlaceholders` corrupts `?` in string literals |
| JP-003 | MEDIUM | `src/app/api/health/route.ts` (9–28) | Health check over-reports success |
| JP-004 | MEDIUM | `src/lib/ai/tailor.ts` (96,127); `src/app/api/profile/ai-assist-cv/route.ts` (47,72) | Silent deterministic AI fallback |
| JP-005 | HIGH | `scripts/setup-supabase.js` (16) | Destructive schema drop |
| JP-006 | MEDIUM | `src/lib/db.ts` (202–208); `src/lib/bootstrap.ts` | Base schema not auto-applied on Postgres |
| JP-007 | MEDIUM | `src/lib/seed.ts` (82) | Demo password echoed in API response |
| JP-008 | LOW | `.github/workflows/ci.yml` | No build step in CI |
| JP-009 | MEDIUM | `.github/workflows/worker.yml`, `browser-worker.yml` | No post-run health verification |
| JP-014 | LOW | `src/lib/ai/tailor.ts` (127); `src/app/api/profile/ai-assist-cv/route.ts` (72) | Swallowed AI errors (no logging) |

## 9. Confirmed runtime failures

- None independently reproduced in this audit (E2E not run). The application is reported live and serving traffic; `/api/health` returns 200 with DB ok per the monitoring workflow design. Runtime workflow correctness remains UNVERIFIED.

## 10. Missing configuration

- None critical in production: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `AI_BASE_URL`, `CRON_SECRET`, `WORKER_TOKEN`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `SENTRY_DSN`, VAPID keys, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` are all set.
- Locally, `DATABASE_URL`/`POSTGRES_URL` are unset → SQLite is used; this is expected for dev but means local behavior differs from production (JP-006, JP-013).
- `SUPABASE_STORAGE_BUCKET` defaults to `jobpilot` if unset; production sets it.

## 11. Missing integrations

- Most Indian job portals (Naukri, Indeed India, LinkedIn, Foundit, Internshala, etc.) are intentionally listed as unavailable in `src/lib/sources/unavailable.ts` with documented reasons and fallback URLs. These are not defects; they are scope limitations. Real discovery depends on the configured source adapters (see `src/lib/sources`).
- AI is configured (DeepSeek) in production; if the key were removed, AI features degrade to deterministic fallback (JP-004).

## 12. Unverified claims

- E2E journeys A–J (section 6) — not executed.
- Cross-database parity of `INSERT OR ...` SQLite-specific syntax — not verified.
- Postgres timestamp return type handling (`Date` vs string) — not verified at runtime (JP-013).
- User isolation between accounts — not tested.
- Dashboard persistence after logout/login — not tested.

## 13. Health score

Methodology (100 points):
- Build/type/tests pass: 25 (all pass → 25)
- Lint tooling: 5 (broken → 0)
- Database provider correctness & self-init: 15 (prod works but self-init gap → 8)
- Storage persistence: 10 (prod configured → 8)
- AI integration honesty: 10 (works but silent fallback → 6)
- Health/monitoring accuracy: 10 (over-reports → 4)
- Security (auth, secrets, isolation): 15 (auth solid; seed leak, destructive script → 10)
- CI coverage: 5 (no build/lint → 2)
- E2E verification: 10 (not performed → 0)

**Total: 72 / 100.**

## 14. Top five issues to repair before early access

1. **JP-005** (HIGH) — Destructive Supabase setup script (`scripts/setup-supabase.js`). Risk of total data loss if run against production.
2. **JP-006** (MEDIUM) — Base schema not auto-applied on Postgres; app cannot self-initialize a fresh database.
3. **JP-002** (MEDIUM) — `toPgPlaceholders` can corrupt queries containing `?` in string literals.
4. **JP-003** (MEDIUM) — Health check over-reports success, masking degraded worker/AI/storage.
5. **JP-007** (MEDIUM) — Dev seed endpoint echoes the hardcoded demo password in its response.

Recommended implementation order: JP-005 → JP-006 → JP-002 → JP-003 → JP-007, each as a small, tested stage, followed by the E2E verification (section 6) with a dedicated test account.

---

**Audit complete. Codebase untouched. Awaiting review before any repair work.**
