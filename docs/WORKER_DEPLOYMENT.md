# Persistent browser worker deployment

This guide covers the **persistent external worker** (`scripts/persistent-worker.mjs`),
introduced for JP-021. The older one-shot worker (`scripts/browser-worker.mjs`)
is still used by the scheduled GitHub Actions fallback; do not confuse the two.

## Why a persistent worker

The scheduled GitHub Actions cron (`*/10`) is subject to provider throttling and
has been observed firing only every 4–8 hours. A one-shot process that exits
after each run cannot keep a heartbeat lease fresh, so the Automation Center
correctly reports the worker **offline** between runs. A long-lived container
solves that by polling continuously and renewing its lease while idle *and*
while processing.

This does **not** weaken the approval-first policy:

- The app only hands out tasks for applications already in `Approved`/`Applying`
  state (`src/lib/worker-tasks.ts`), and only when demo mode is off.
- The worker never marks an application `Applied` without an explicit positive
  confirmation message on the employer's result page. `classifySubmissionResult`
  plus `normalizeTaskResult` downgrade anything else to `manual_required` or
  `failed`. A clicked submit button, a changed URL, or an absent error is never
  treated as success.
- Results are recorded once by the server's atomic gate
  (`src/lib/worker-result.ts`); a duplicate callback is harmless.

## What the process does

1. On startup, posts one `online` heartbeat (idle) using the header-only token.
2. Polls `/api/automation/worker/tasks/claim` with bounded exponential retries.
3. Refreshes the `online` lease on a heartbeat interval, setting
   `meta.processing: true` (with the task id) while a task is in flight.
4. Reports the result through the existing idempotent result API; duplicate
   responses are logged and treated as success.
5. On `SIGTERM`/`SIGINT`, stops claiming, finishes or abandons the current task
   with an honest `manual_required`/`failed` result, posts **one** `offline`
   heartbeat, and exits. It never posts offline merely because a poll ended —
   the only offline post is an actual shutdown.
6. If lease renewal fails repeatedly, it abandons the task as `failed` so the
   server's 10-minute stale-lock recovery can re-queue it; it never reports
   success for a task whose lease was lost.

Retryable transport and 5xx errors are retried with exponential backoff
(`base * 2^attempt`, capped). 401/404 are fatal (configuration/credential
errors) and stop the worker; other 4xx responses (for example a 422 for a
recovered stale lock) are logged and skipped without failing the run.

## Configuration

Secrets are supplied only through the environment. `WORKER_TOKEN` is sent in
the `x-worker-token` header; it is never placed in a heartbeat body, a task
payload, a log line, or an image layer.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_URL` | required | Base URL of the Next.js app (no trailing slash needed). |
| `WORKER_TOKEN` | required | Must match the app's `WORKER_TOKEN`. |
| `POLL_INTERVAL_MS` | `5000` | Delay between empty polls. |
| `HEARTBEAT_INTERVAL_MS` | `15000` | Lease renewal cadence; keep well below the app's `WORKER_ONLINE_WINDOW_MS` (default 30 min). |
| `MAX_ATTEMPTS` | `4` | Bounded retries per API operation. |
| `RETRY_BASE_MS` / `RETRY_MAX_MS` | `500` / `30000` | Exponential backoff bounds. |
| `MAX_TASKS` | unlimited | Optional rolling-restart safety limit. |
| `HEADLESS` | `true` | Set to `false` only for local debugging. |
| `BROWSER_TIMEOUT_MS` | `120000` | Playwright navigation/action timeout. |

On the app side, keep `WORKER_TOKEN` consistent and leave
`WORKER_ONLINE_WINDOW_MS` at its default unless you understand the lease
semantics in `src/lib/automation.ts` (`workerStatusSnapshot`).

## Build and run (any Docker host)

```bash
docker build -f Dockerfile.browser-worker -t jobpilot-browser-worker .
docker run -d --name jobpilot-worker --restart unless-stopped \
  -e APP_URL=https://your-app.example \
  -e WORKER_TOKEN=<from the app environment> \
  jobpilot-browser-worker
docker logs -f jobpilot-worker
docker stop jobpilot-worker   # sends SIGTERM; graceful drain + offline heartbeat
```

Do not pass credentials on a command line that is recorded in shell history or
`docker inspect`; use a secret manager, an env file with restricted permissions,
or your platform's secret store. Never paste real token values into issues,
logs, or documentation.

### Fly.io

```bash
fly apps create jobpilot-browser-worker
fly secrets set APP_URL=https://your-app.example
fly secrets set WORKER_TOKEN=<from the app environment>
fly deploy -f Dockerfile.browser-worker
fly logs
```

Fly machines may be stopped when idle on some plans; prefer a always-on machine
or a paid plan so the lease does not expire. The app will report `offline` when
the container is genuinely stopped — that is correct behaviour.

### Railway / Render / any container platform

Set the Dockerfile path to `Dockerfile.browser-worker`, add `APP_URL` and
`WORKER_TOKEN` as secret environment variables, and ensure the platform sends
`SIGTERM` (with a grace period of at least 30 seconds) before `SIGKILL`.

## Running alongside the scheduled fallback

Both workers use the same conditional claim and idempotent result API, so
concurrent operation cannot double-record a result. However, running both
against the same app is unnecessary once the persistent worker is healthy; keep
the workflow disabled or manual to avoid redundant browser work and confusing
ownership of tasks. A one-shot run deliberately leaves an idle `online` lease
when it exits (see JP-020), so do not read that lease as proof that a browser
process is still alive — use the container's own health signals too.

## Verification before any production rollout

- `npx vitest run src/lib/persistent-worker.test.ts` — orchestration tests use a
  virtual clock, fake fetch and injected executor; no network, browser, DB or
  credentials are involved.
- `npm run typecheck`.
- In a **local or staging** environment with a fake employer page and a test
  token only: confirm startup `online`, periodic renewal, `processing:true`
  during a long task, explicit-confirmation-only `applied`, exactly-once result,
  harmless duplicate callback, reconnect after a forced network failure,
  expired-lock recovery, and graceful `SIGTERM` drain with a single offline
  heartbeat.
- Check that logs contain no `WORKER_TOKEN` value and no applicant PII.

Deployment itself, real employer applications, and email delivery are out of
scope for this change and require separate explicit approval.

## Residual risks

- The browser executor uses a conservative generic field matcher plus a strict
  explicit-confirmation selector; it does not include the per-ATS adapters that
  exist only in the one-shot worker. Complex ATS forms will correctly end up as
  `manual_required` rather than a false `Applied`.
- Availability depends on the hosting platform actually keeping the container
  running. Lease expiry is honest: if the process is killed, the app reports
  offline after the window elapses.
- Heartbeat renewal during a task is best-effort; a prolonged network partition
  causes the worker to abandon the task as `failed` and let stale-lock recovery
  re-queue it, which may delay that application.
