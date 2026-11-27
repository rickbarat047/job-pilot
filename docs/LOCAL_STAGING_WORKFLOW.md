# JP-023 — Isolated local staging workflow (manual, ₹0)

Purpose: prove the JP-022 persistent worker processes one fake-employer task through
the real local app API and database **before** any worker is connected to production.
Nothing here contacts production, Supabase, real employers, email or push services.

## Important

- Do **not** use the production `DATABASE_URL`, `WORKER_TOKEN`, Supabase keys, AI keys,
  email credentials or push credentials.
- Do **not** register or start any Windows Task Scheduler task. `scripts/windows/*.ps1`
  remain dry-run/inert; use them only after reviewing and running manually at your own pace.
- `scripts/staging/run-local-staging.mjs` is self-contained: it starts its own stub,
  Next dev app and bounded persistent worker, then cleans them up.

## One-command proof (recommended)

Prerequisites: local PostgreSQL 17.12 data dir, Node v26, Playwright 1.65.1 browsers.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:PATH='C:\Users\rickb\AppData\Local\Temp\opencode\node-portable-v26\node-v26.13.1-win-x64;'+$env:PATH

# Start the disposable local Postgres cluster if it is not running.
$pg='C:\Users\rickb\AppData\Local\Temp\opencode\pg17\pgsql\bin'
& "$pg\pg_ctl.exe" -D 'C:\Users\rickb\AppData\Local\Temp\opencode\pgdata-e2e' -o '-p 55432 -h 127.0.0.1' -l 'C:\Users\rickb\AppData\Local\Temp\opencode\pgdata-e2e\server.log' start
& "$pg\pg_isready.exe" -h 127.0.0.1 -p 55432

# Staging-only environment. Never use production values here.
$env:APP_URL='http://127.0.0.1:3000'
$env:DATABASE_URL='postgres://postgres@127.0.0.1:55432/jobpilot_staging?sslmode=disable'
$env:WORKER_TOKEN='staging-only-worker-token'
$env:E2E_ALLOW_FIXTURE='1'

node scripts/staging/run-local-staging.mjs
```

Expected final line: `Staging proof: 11/11 checks passed` and exit code 0.

## Manual step-by-step (if you want to run pieces separately)

1. **Start the database** — the `pg_ctl`/`pg_isready` commands above.
2. **Start JobPilot locally** (terminal 1):
   ```powershell
   $env:NODE_ENV='development'
   $env:APP_URL='http://127.0.0.1:3000'
   $env:DATABASE_URL='postgres://postgres@127.0.0.1:55432/jobpilot_staging?sslmode=disable'
   $env:DATABASE_SSL='false'
   $env:WORKER_TOKEN='staging-only-worker-token'
   $env:E2E_ALLOW_FIXTURE='1'
   $env:E2E_FIXTURE_JOBS='./scripts/e2e/fixtures.json'
   node node_modules/next/dist/bin/next dev -p 3000
   ```
3. **Start the fake employer/AI stub** (terminal 2): `node scripts/e2e/stub-server.mjs`.
4. **Start a bounded persistent worker** (terminal 3):
   ```powershell
   $env:APP_URL='http://127.0.0.1:3000'
   $env:WORKER_TOKEN='staging-only-worker-token'
   $env:MAX_TASKS='1'
   $env:POLL_INTERVAL_MS='500'
   $env:HEARTBEAT_INTERVAL_MS='1000'
   $env:HEADLESS='true'
   node scripts/persistent-worker.mjs
   ```
5. **Check worker health**: `GET http://127.0.0.1:3000/api/automation/worker` should show
   `online: true` while the worker runs; `GET /api/health` should show `worker: "online"`
   and overall `ok` only if all other local dependencies are healthy. With the worker
   stopped, both correctly report offline/degraded.
6. **Stop the worker** with Ctrl+C (or `stop-worker.ps1` only after you have manually
   installed/registered it). It drains and posts one honest offline heartbeat.
7. **Reset test data**: rerun `node scripts/staging/run-local-staging.mjs`; it truncates
   and reseeds only the dedicated `jobpilot_staging` database. Never point it at any
   other database.

## Safety guard

`src/lib/staging-guard.ts` (`assertStagingConfig`) fails closed when:
- `APP_URL` is not localhost/127.0.0.1/::1,
- `DATABASE_URL` is not a local PostgreSQL URL,
- any Supabase URL/key variable is present,
- `WORKER_TOKEN` is missing or looks production-like,
- `E2E_ALLOW_FIXTURE=1` is absent.

No production secret is printed, committed or used.
