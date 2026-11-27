# Local staging workflow (free-only)

This workflow proves that `scripts/persistent-worker.mjs` can safely process a
fake-employer application against an **isolated local staging** JobPilot app and
database. It uses only the operator's existing Windows PC and local PostgreSQL;
no paid hosting, no Docker Desktop, no production database, no production
secrets, and no real employer/email side effects.

## Safety model

`scripts/staging/run-local-staging.mjs` refuses to run unless:

- `APP_URL` is a local `http://127.0.0.1[:port]` / `localhost` / `::1` URL.
- `DATABASE_URL` is a local PostgreSQL URL; host and database are verified
  before any destructive command (`TRUNCATE` only happens on database
  `jobpilot_staging` at a local host).
- `WORKER_TOKEN` is a staging-only token (no `prod`/`production`).
- `E2E_ALLOW_FIXTURE=1` and a local fixture job file are configured.
- No Supabase, email, push, storage, cloud, analytics or other external-service
  credentials are present. The authoritative guard is
  `src/lib/staging-guard.ts` (`assertStagingConfig` + `restrictedStagingEnv`).
- Child processes receive a restricted, allowlisted environment; production
  credentials are never inherited.

The runner discovers PostgreSQL portably: it searches `PG_BIN` first, then
`PATH`, and validates that `psql`, `createdb` and `pg_isready` exist before
doing anything. No personal or temporary absolute path is embedded in the
repository.

## 1. Discover PostgreSQL on Windows

```powershell
# Option A: already on PATH
where.exe psql
where.exe createdb
where.exe pg_isready

# Option B: set PG_BIN to the bin directory of the local PostgreSQL install
$env:PG_BIN = 'C:\path\to\PostgreSQL\bin'
& "$env:PG_BIN\pg_isready.exe" -h 127.0.0.1 -p 55432
```

If `pg_isready` reports “accepting connections”, skip to step 2. To start the
local disposable cluster (adjust the data directory to your own install):

```powershell
# Start
& 'C:\path\to\PostgreSQL\bin\pg_ctl.exe' `
  -D 'C:\path\to\pgdata-e2e' `
  -o '-p 55432 -h 127.0.0.1' `
  -l 'C:\path\to\pgdata-e2e\server.log' start

# Stop later
& 'C:\path\to\PostgreSQL\bin\pg_ctl.exe' -D 'C:\path\to\pgdata-e2e' stop
```

## 2. Run the repeatable staging proof

```powershell
# One-time per shell: Node v26 on PATH
$env:PATH = 'C:\path\to\node-v26-win-x64;' + $env:PATH

# Full proof: DB setup, fake employer, local app, persistent worker, health checks
npm run test:staging
```

Expected tail:

```text
Staging proof: 15/15 checks passed
```

The proof covers: config guard, portable PG discovery, PG accepting, exact DB
name `jobpilot_staging`, local host, seeded approved task, fake employer, local
app, offline-health degraded before worker start, worker online heartbeat,
application Applied, exactly one submit event, task succeeded, clean bounded
worker exit, and lease-expired offline health.

`MAX_TASKS=1` keeps the worker bounded. It is never registered with Task
Scheduler by this workflow.

## 3. Manual step-by-step (if you want each process in its own terminal)

1. Start the local database (above) and create `jobpilot_staging`.
2. Start the fake employer/AI stub:
   `node scripts/e2e/stub-server.mjs` (listens on `127.0.0.1:4599`).
3. Start the app with staging-only env:
   ```powershell
   $env:APP_URL='http://127.0.0.1:3000'
   $env:DATABASE_URL='postgres://postgres@127.0.0.1:55432/jobpilot_staging?sslmode=disable'
   $env:WORKER_TOKEN='local-staging-worker-token'
   $env:E2E_ALLOW_FIXTURE='1'
   $env:E2E_FIXTURE_JOBS='scripts/e2e/fixtures.json'
   npm run dev
   ```
4. Start the persistent worker in another terminal with the same `APP_URL` and
   `WORKER_TOKEN`, plus `MAX_TASKS=1`, `HEADLESS=true`, `POLL_INTERVAL_MS=500`,
   `HEARTBEAT_INTERVAL_MS=1000`, `BROWSER_TIMEOUT_MS=60000`.
5. Check health:
   `curl http://127.0.0.1:3000/api/automation/worker` and
   `curl http://127.0.0.1:3000/api/health`.
6. Stop the worker with Ctrl+C or `SIGTERM`; the app should report offline after
   the lease window elapses.

## 4. Reset test data safely

The staging proof truncates only `jobpilot_staging` and only after verifying
the database name and local host. To reset manually:

```powershell
psql -h 127.0.0.1 -p 55432 -U postgres -d jobpilot_staging `
  -c 'TRUNCATE users, jobs, automation_tasks, automation_runs, worker_status CASCADE;'
```

Never run this command against any other database.

## 5. Which tests ran locally vs CI

- Locally: `npm ci`, `npm audit`, `npm run typecheck`, `npm run lint`,
  `npm test`, `npm run test:e2e`, `npm run build`, `npm run test:staging`.
- CI: `.github/workflows/staging-proof.yml` is `workflow_dispatch` only and has
  **not been run yet**; it uses a disposable `postgres:17` service and the same
  fake employer. Do not claim CI verification until an operator runs it.

## 6. Known non-fatal warnings

`bootstrapDatabase` can log duplicate-column notices for `last_login_at` /
`login_count` when those columns already exist. These are informational and do
not fail the proof.
