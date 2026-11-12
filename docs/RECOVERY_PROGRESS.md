# JobPilot AI — Recovery Progress

## Baseline (recovery/main branch)

- Branch: `recovery/main` (created from `main` at `78add27`).
- Working tree: clean before branch creation.
- Type check: `tsc --noEmit` — PASS (0 errors).
- Tests: `vitest run` — 8 test files, 32 tests — PASS.
- Production build: `next build` — PASS (exit 0); `/mobile-home` route present.
- Uncommitted user work: none found.

## Blocker identified

`docs/RECOVERY_AUDIT.md` (referenced by the recovery directive as already created) is **not present** in this repository. No `docs/` directory exists. The audit report therefore cannot be used as the source of truth until it is produced. I have not invented findings to fill this gap.

## Changes made this stage

### Targeted fix: GitHub Actions browser worker (scripts/browser-worker.mjs)

Scope: only `scripts/browser-worker.mjs`, new helper `scripts/browser-worker-lib.mjs`, new tests `src/lib/browser-worker.test.ts`. No schema, auth, features, or deployment config changed. Workflow `.github/workflows/browser-worker.yml` left unchanged (ONE_SHOT=1 and */10 schedule preserved).

Changes:
- Env validation now fails clearly when `APP_URL` is missing (previously defaulted to localhost) and when `WORKER_TOKEN` is missing.
- `heartbeat(status, meta)` now takes an explicit worker status (`online`/`offline`) and sends `status` as a top-level JSON property; `meta` no longer carries/overrides status.
- Online heartbeat sent when the worker starts; periodic online heartbeats continue during processing.
- Graceful shutdown sends an `offline` heartbeat.
- `api()` throws an `ApiError` carrying the HTTP status; 401 fails the workflow with a useful message; 404 and 5xx are not treated as success (they propagate instead of being swallowed).
- Empty task queue (`!claimed.task`) is explicitly treated as non-error.
- Shutdown tracking: an earlier processing failure is preserved and reflected in the exit code even if the offline heartbeat fails (via `shutdownExitCode`).
- `WORKER_TOKEN` is never logged.
- 90-second online threshold in `workerIsOnline()` left untouched.

Tests added (`src/lib/browser-worker.test.ts`): 17 tests covering env validation, heartbeat payloads (online/offline, top-level status, invalid status), auth-failure detection, empty-queue handling, HTTP status classification, and shutdown exit codes.

### Earlier fix: stop leaking the demo password via the seed endpoint response
- File: `src/lib/seed.ts`
- Change: the `seedDemo()` return message no longer echoes the hardcoded demo password (`Demo@12345`).
- Checks: typecheck PASS; vitest 32/32 PASS at that time.

## Remaining work / next recommended task

The recovery directive (P0 → foundation → core workflow → frontend → testing → deployment) cannot be executed against a documented P0 list because the audit report is missing. Recommended next step: run the full audit (Phase A–J from the original audit prompt) and write `docs/RECOVERY_AUDIT.md` before touching P0 issues, so fixes are driven by verified findings rather than guesses. Alternatively, the operator can point me at a specific P0 to fix first.

## Test results (browser worker stage)

- `npm run typecheck` (`tsc --noEmit`): PASS (0 errors).
- `npm test` (`vitest run`): PASS — 9 test files, 56 tests (24 browser-worker tests).
- `node --check scripts/browser-worker.mjs`: PASS.
- `node --check scripts/browser-worker-lib.mjs`: PASS.
- No production deployment, commit, or push performed (per instruction).

### Follow-up fix: heartbeat error handling in main()

Additional change to `scripts/browser-worker.mjs`:
- Removed `.catch(() => {})` swallowing on startup heartbeat; critical failures (auth/404/5xx) are now recorded in `criticalHeartbeatFailed` and reflected in the exit code.
- Periodic heartbeat failures are recorded via `.catch()` (no unhandled rejections) and critical ones set the flag.
- `heartbeat()` no longer calls `process.exit(1)` directly; instead throws so callers can perform graceful shutdown.
- Added `isCriticalHeartbeatFailure()` helper and extended `shutdownExitCode()` with a third parameter.

Additional tests: 7 new tests (critical heartbeat failure detection + exit code with critical flag). Total browser-worker tests: 24.

---

## GitHub Actions browser-worker recovery (run #31 / #32)

### Original root cause
HTTP 401 "Invalid worker token." from `POST /api/automation/worker`. The GitHub Actions secret `WORKER_TOKEN` does not match the `WORKER_TOKEN` configured in Vercel production. Verified by reproducing the 401 against the production endpoint. The application code is not at fault: run #32 (commit `03dd406`) executed the new implementation correctly and surfaced the 401 clearly, then exited 1.

### Exact fix (code)
No code defect remained. The worker implementation is correct and deployed. The fix required is configuration alignment (manual, see below).

### Files modified (code)
- `scripts/browser-worker.mjs`
- `scripts/browser-worker-lib.mjs`
- `src/lib/browser-worker.test.ts`

### Commit SHA / branch
- Commit: `03dd406` ("Improve browser worker heartbeat error handling and shutdown exit codes")
- Branch deployed: `main` (pushed to origin)
- Vercel: production deployment `● Ready`

### Test results
- `npm run typecheck`: PASS (0 errors)
- `npm test`: PASS — 9 files, 56 tests
- `npm run build`: PASS
- `node --check` (both scripts): PASS

### GitHub Actions run
- Run #31: https://github.com/rickbarat047/job-pilot/actions/runs/43281700217 — failure (401), commit `633ba31`
- Run #32: https://github.com/rickbarat047/job-pilot/actions/runs/43283493263 — failure (401), commit `03dd406`
- Exit code: 1 (expected, given the token mismatch)
- Startup heartbeat: failed with 401 (clearly reported)
- Task-claim: not reached (startup heartbeat aborted)
- Shutdown heartbeat: failed with 401
- Errors were not silently swallowed (logged clearly)

### Runtime worker verified
Code path verified: startup heartbeat, 401 handling, graceful shutdown, and exit code all behaved as designed. The worker is NOT permanently Online (scheduled one-shot worker; goes Offline between runs).

### Remaining issues
- `WORKER_TOKEN` mismatch between GitHub Actions and Vercel production. This is the sole blocker preventing a successful run.

### Required manual configuration
- Variable name: `WORKER_TOKEN`
- Location 1 (GitHub): Repository Settings → Secrets and variables → Actions → `WORKER_TOKEN` (used by `browser-worker.yml`).
- Location 2 (Vercel): Project Settings → Environment Variables → `WORKER_TOKEN` (used by the app's `/api/automation/worker` endpoint via `verifyWorkerToken`).
- Action: set the SAME value in both places. The current values differ (both return 401 against the other). Do not paste the value in chat; update both stores directly. After updating, re-run the `browser-worker.yml` workflow via workflow_dispatch to verify a 200 heartbeat and exit code 0.
