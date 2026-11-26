# E2E: discovery → application

This suite proves the JobPilot workflow from job discovery through a real browser
submission **without touching production**. It uses:

- a disposable PostgreSQL database (local portable Postgres or a CI service),
- an env-gated fixture source adapter (`fixtureAdapter`), inactive by default,
- a localhost-only stub providing deterministic AI replies and a fake employer
  application form with an explicit confirmation page,
- the real Next.js app started from this checkout,
- the real `scripts/browser-worker.mjs` driven by Playwright.

No production database, credentials, AI provider, email provider or live website
is used. Authentication and approval flows go through the real HTTP APIs; only
test-user fixture data is seeded directly into the disposable DB.

## Running locally

Prerequisites: Node >= 24, a PostgreSQL server on `127.0.0.1:55432` with database
`jobpilot_e2e` and migrations `0001_schema.sql` + `0003_push_subscriptions.sql`
applied, and Playwright browsers installed (`npx playwright install chromium
chromium-headless-shell`).

```bash
npm run test:e2e
```

Ports can be overridden with `E2E_APP_PORT`, `E2E_STUB_PORT`, `E2E_DB_PORT`,
`E2E_DB_USER`, `E2E_DB_PASSWORD` and `E2E_DB_NAME`.

## Stages verified

| Stage | What is asserted |
| --- | --- |
| A — auth | Real registration via `/api/auth/register` with same-origin check and session cookie |
| B — discovery | `/api/discovery/run` with `sourceKeys:['fixture']` yields 3 jobs and matches; automation run succeeds |
| C — tailoring | `/api/jobs/:id/tailor` returns `provider: 'ai'` from the local stub, creates an application in `Draft Ready` |
| D — approval | `/api/applications/:id/approve` transitions the application to `Approved` |
| E — submit | `/api/applications/:id/submit` with `method:'browser'` enqueues a browser task after a real worker heartbeat |
| F — worker | Real worker child process exits 0 and the DB shows `Applied`, `applied_at`, `application.submitted_browser`, and a succeeded task |
| G — failures | Missing worker token → 401; submit before approval → error; duplicate result recorded; AI stub unavailable → deterministic tailoring still succeeds |

## Known defects surfaced (not fixed here)

- `recordWorkerResult()` has no idempotency guard: duplicate result posts create
  duplicate events/notifications and can overwrite `applied_at`. The E2E records
  this but does not claim idempotency.
- `browser-worker.mjs` can report `applied` with an "assumed success" message when
  a page shows neither explicit success nor failure text. The E2E fake employer
  page always shows explicit confirmation so the happy path is genuine.
- `workerIsOnline()` uses a 12-hour window, so a crashed worker can appear online
  for hours.

## CI

`.github/workflows/e2e.yml` runs on manual dispatch and weekly, using a
`postgres:17` service and Playwright browser installation. See
`OPENCODE_PROJECT_RECOVERY.md` for recorded run evidence.
