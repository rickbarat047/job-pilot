# Browser worker hosting

The Playwright auto-apply worker lives in `scripts/browser-worker.mjs`. It needs a
host that can run a persistent Node process with Chromium (not serverless).

## Option A — Fly.io (recommended, free tier)

```bash
# one-time
fly auth login
fly launch --no-deploy --copy-config --name jobpilot-browser-worker
fly secrets set APP_URL=https://jobpilot-ai-sand.vercel.app
fly secrets set WORKER_TOKEN=<value from Vercel env>
fly deploy
```

The provided `fly.toml` and `Dockerfile.browser-worker` are ready to use.

## Option B — Railway

1. New project → Deploy from GitHub repo → set root to `/` and Dockerfile path `Dockerfile.browser-worker`.
2. Variables: `APP_URL`, `WORKER_TOKEN`, `HEADLESS=true`.
3. Deploy. Railway restarts on crash.

## Option C — any VPS (Docker)

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
