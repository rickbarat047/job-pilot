# JobPilot Playwright worker

This is the browser-automation service for JobPilot AI. It polls the Next.js app
for applications the candidate has already approved, fills the employer's public
form, uploads the tailored resume/cover letter, and reports one of three truthful
outcomes:

- `applied` — the employer page showed a confirmation, or the worker verified a
  confirmation URL/text.
- `manual_required` — a CAPTCHA, login wall, MFA step, account creation, unknown
  required question, or ambiguous confirmation. The application returns to
  **Approved** so the candidate can finish it.
- `failed` — a transient error. The app retries with exponential backoff up to
  `max_attempts`.

It never bypasses CAPTCHAs, MFA, login walls, or account creation.

## How it connects

The worker only needs two values:

| Variable | Meaning |
| --- | --- |
| `APP_URL` | Production URL, for example `https://jobpilot-ai-sand.vercel.app` |
| `WORKER_TOKEN` | The same secret set on the Next.js deployment |

The worker calls these token-authenticated endpoints:

- `POST /api/automation/worker` — heartbeat
- `POST /api/automation/worker/tasks/claim` — atomically claim one task
- `GET /api/automation/worker/documents/:id?taskId=...` — download a document
- `POST /api/automation/worker/tasks/:id/result` — report the outcome

The app does **not** need a `WORKER_URL` for this flow because the worker polls
outbound. That also works behind firewalls and on serverless hosting.

## Local run

```bash
cd worker
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
export APP_URL=http://localhost:3000
export WORKER_TOKEN=local-worker-token
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open **Settings → Browser automation worker** in JobPilot; it should show
**Online** within ~15 seconds. Approve an application and choose **Use browser
automation** on its detail page.

Useful endpoints while debugging:

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/run-once -H "x-worker-token: local-worker-token"
```

Set `DRY_RUN=true` to test the queue/heartbeat/result flow without opening a
browser or submitting anything.

## Deploy to Render

The repository includes `render.yaml` at the root.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repo. Render reads
   `render.yaml` and builds `worker/Dockerfile`.
3. Set `APP_URL` to your production URL and `WORKER_TOKEN` to the same value used
   by Vercel.
4. Deploy. The health check is `/health`.
5. Confirm **Settings → Browser automation worker** shows **Online**.

## Deploy to Fly.io

```bash
cd worker
fly launch --no-deploy --copy-config
fly secrets set APP_URL=https://your-app.vercel.app WORKER_TOKEN=your-token
fly deploy
fly logs
```

`fly.toml` uses one shared CPU and 1 GB RAM, which is enough for one Chromium
session at a time. Keep `min_machines_running = 1` so the worker does not sleep.

## Deploy with Docker / a VPS

```bash
docker build -t jobpilot-worker worker
docker run -d --restart unless-stopped \
  -p 8000:8000 \
  -e APP_URL=https://your-app.vercel.app \
  -e WORKER_TOKEN=your-token \
  -e ENABLE_POLLER=true \
  --name jobpilot-worker \
  jobpilot-worker
```

Put it behind HTTPS if you expose it publicly. The poller only makes outbound
requests, so inbound access is not required.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` | JobPilot app URL |
| `WORKER_TOKEN` | local dev token | Shared secret; must match Vercel |
| `ENABLE_POLLER` | `true` | Start the background poll loop |
| `POLL_INTERVAL_SECONDS` | `15` | Delay between empty polls |
| `HEADLESS` | `true` | Run Chromium headless |
| `DRY_RUN` | `false` | Skip browser launch; report manual_required |
| `WORKER_NAV_TIMEOUT_MS` | `45000` | Page navigation timeout |
| `WORKER_ACTION_TIMEOUT_MS` | `12000` | Form action timeout |
| `SCREENSHOT_DIR` | `/tmp/jobpilot-screenshots` | Failure screenshots |
| `LOG_LEVEL` | `INFO` | Python log level |

## Safety and limitations

- Only applications in **Approved** state are eligible.
- Demo mode disables browser submissions.
- Sensitive application questions are never auto-answered; the worker stops and
  asks the candidate.
- Workday, iCIMS, Taleo, and SuccessFactors usually require an employer account,
  so the worker reports `manual_required`.
- A single worker processes one Chromium session at a time. Scale horizontally
  only after adding per-task locking (already done through the atomic claim) and
  enough memory for concurrent browsers.
- The worker does not store employer pages, cookies, or credentials.

## Tests / syntax check

```bash
python -m py_compile main.py client.py automation.py
```
