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
