# Browser worker hosting

The Playwright auto-apply worker lives in `scripts/browser-worker.mjs`. It needs a
host that can run a Node process with Chromium.

## Option A — GitHub Actions (recommended, completely free)

The repo is **public**, so GitHub Actions minutes are unlimited. A scheduled
workflow (`.github/workflows/browser-worker.yml`) runs the worker in `ONE_SHOT`
mode every 10 minutes: it installs Playwright, processes one queued task, then exits.

**Required GitHub secrets (repo → Settings → Secrets and variables → Actions):**
- `APP_URL` = `https://jobpilot-ai-sand.vercel.app`
- `WORKER_TOKEN` = your Vercel `WORKER_TOKEN` value

**Notes:**
- The worker reports `online` only while a run is executing; between runs it shows
  `offline` in Automation Center (honest — no persistent browser is running).
- Each run installs Playwright (~1–2 min), leaving ~3 min for the task.
- To trigger immediately: repo → Actions → "Browser worker" → Run workflow.

## Option B — Fly.io (free trial, then $5/mo credit)

```bash
fly auth login
fly apps create jobpilot-browser-worker
fly --app jobpilot-browser-worker secrets set APP_URL=https://jobpilot-ai-sand.vercel.app
fly --app jobpilot-browser-worker secrets set HEADLESS=true
fly --app jobpilot-browser-worker secrets set WORKER_TOKEN=<value from Vercel env>
fly --app jobpilot-browser-worker deploy
fly --app jobpilot-browser-worker logs
```

Uses `Dockerfile.browser-worker` + `fly.toml` (Playwright base image).
⚠️ Fly's free trial stops machines after 5 min unless a credit card is added
(no charge while under the $5/mo free allowance). For a truly free, no-card
setup, use Option A.

## Option C — Railway

1. New project → Deploy from GitHub repo → Dockerfile path `Dockerfile.browser-worker`.
2. Variables: `APP_URL`, `WORKER_TOKEN`, `HEADLESS=true`.
3. Deploy.

## Option D — any VPS (Docker)

```bash
docker build -f Dockerfile.browser-worker -t jp-worker .
docker run -d --restart unless-stopped \
  -e APP_URL=https://jobpilot-ai-sand.vercel.app \
  -e WORKER_TOKEN=<value> \
  jp-worker
```

## Local dev / one-shot

```bash
npm install playwright
npx playwright install chromium
APP_URL=http://localhost:3000 WORKER_TOKEN=change-me-local-worker-token ONE_SHOT=1 node scripts/browser-worker.mjs
```

## Notes
- The worker reports `online` to `/api/automation/worker` every 20s via heartbeat.
- It claims one task at a time, runs it, and posts the result.
- Generic form-filling is heuristic; per-ATS adapters (Greenhouse, Lever, Workday) can be added in `executeTask` for higher reliability. Until then, ambiguous submissions are reported as `manual_required` rather than falsely marked applied.
- `WORKER_TOKEN` must match Vercel's `WORKER_TOKEN` env var.
- For the GitHub Actions option (Option A), add `WORKER_TOKEN` to GitHub secrets.
