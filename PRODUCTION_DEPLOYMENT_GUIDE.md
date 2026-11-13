# JobPilot AI — Production Deployment Guide

This guide walks through deploying JobPilot AI to production on **Vercel + Supabase** with the **Playwright Worker** on Render or Fly.io.

---

## Prerequisites

- GitHub account (for Vercel/Render/Fly.io integration)
- Vercel account
- Supabase account
- Render or Fly.io account (for Playwright worker)
- Domain name (optional, for custom domain)

---

## 1. Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization, enter name (e.g., `jobpilot-ai`), generate a strong database password, select region closest to users (e.g., `ap-south-1` for India)
4. Wait for project to be ready (~2 minutes)

### 1.2 Run Migrations

1. In Supabase Dashboard → SQL Editor
2. For a **fresh database**, run these in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_push_subscriptions.sql`
   - `supabase/migrations/0004_push_subscriptions_rls.sql`
3. For a **pre-existing database**, first reconcile Supabase migration history against the actual schema. Do not blindly replay the baseline migrations (`0001_schema.sql`, `0002_rls.sql`), because some statements (especially RLS policy creation) are not idempotent and may fail or duplicate objects. Apply only the migrations whose objects are missing, or repair migration history first.
4. Verify tables created: Go to Table Editor, you should see the application tables including `push_subscriptions`

### 1.3 Create Storage Bucket

1. Storage → Create Bucket
2. Name: `jobpilot` (or your preferred name)
3. Public: **No** (keep private)
4. Save

### 1.4 Get Connection Details

From Supabase Dashboard → Settings → Database:

- **Connection string (session pooler, port 5432)**: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
- Do **not** use the transaction pooler on port 6543 for this app; use the Supabase **Session Pooler** on port 5432.
- **Project URL**: `https://[ref].supabase.co`
- **Service Role Key**: Settings → API → `service_role` key (keep secret!)
- **Anon Key**: Settings → API → `anon` key

---

## 2. Vercel Deployment

### 2.1 Import Repository

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework Preset: Next.js (auto-detected)
4. Root Directory: `./` (default)

### 2.2 Configure Environment Variables (Production)

Add these in Vercel → Project → Settings → Environment Variables → **Production**:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `APP_URL` | `https://your-app.vercel.app` | Update after first deploy |
| `DATABASE_URL` | Supabase session pooler URL (port 5432) | **Required** |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | **Required in production** for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | **Required in production**, server-only secret |
| `DATABASE_SSL` | `true` | |
| `SUPABASE_URL` | `https://[ref].supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase | **Secret** |
| `SUPABASE_STORAGE_BUCKET` | `jobpilot` | |
| `APP_ENCRYPTION_KEY` | 32-byte hex (generate: `openssl rand -hex 32`) | **Secret** |
| `CRON_SECRET` | Random string (generate: `openssl rand -hex 32`) | **Secret** |
| `WORKER_TOKEN` | Random string (generate: `openssl rand -hex 32`) | **Secret**, must match worker |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` | Or your AI provider |
| `AI_MODEL` | `openai/gpt-4o-mini` | |
| `AI_API_KEY` | Your OpenRouter/API key | **Secret** |
| `AI_TIMEOUT_MS` | `45000` | |
| `AI_TEMPERATURE` | `0.2` | |
| `DEMO_MODE` | `false` | Disable demo mode in production |

> **Note**: `DATABASE_PATH` and `STORAGE_DIR` are for local dev only. Do NOT set them in production.

### 2.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. After deployment, note the production URL (e.g., `https://jobpilot-ai-xxx.vercel.app`)
4. Update `APP_URL` environment variable to this exact URL
5. Redeploy (Vercel → Deployments → "Redeploy" on latest)

### 2.4 Verify Deployment

```bash
curl https://your-app.vercel.app/api/health
# Should return: {"status":"ok","database":"ok","ai":"configured","worker":"offline",...}
```

---

## 3. Playwright Worker Deployment

The worker is a separate Python/FastAPI service that polls the app for browser automation tasks.

### Option A: Render (Recommended — free tier available)

1. Go to https://dashboard.render.com
2. New → Blueprint → Connect your GitHub repo
3. Render will detect `render.yaml` at root
4. Click "Apply"
5. In the created service → Environment:
   - Add `APP_URL` = `https://your-app.vercel.app`
   - Add `WORKER_TOKEN` = same value as Vercel
6. Deploy
7. Verify: `curl https://your-worker.onrender.com/health`

### Option B: Fly.io

```bash
cd worker
fly launch --no-deploy --copy-config
# Edit fly.toml if needed (app name must be globally unique)
fly secrets set APP_URL=https://your-app.vercel.app WORKER_TOKEN=your-worker-token
fly deploy
fly logs
```

### Option C: Docker/VPS

```bash
docker build -t jobpilot-worker worker
docker run -d --restart unless-stopped \
  -p 8000:8000 \
  -e APP_URL=https://your-app.vercel.app \
  -e WORKER_TOKEN=your-worker-token \
  -e ENABLE_POLLER=true \
  --name jobpilot-worker \
  jobpilot-worker
```

> **Important**: Set `APP_URL` and `WORKER_TOKEN` on **both** Vercel and the worker. They must match exactly.

### 3.4 Verify Worker Connection

1. In Vercel dashboard, check worker status:
   ```bash
   curl https://your-app.vercel.app/api/automation/worker
   # Should return: {"status":"online","lastHeartbeat":"...","online":true,...}
   ```
2. In JobPilot UI: Settings → Browser Automation Worker should show "Online"

---

## 4. SMTP Configuration (Optional)

For email-based applications and notifications:

1. In JobPilot UI: Settings → Email Integration
2. Enter:
   - **SMTP Host**: `smtp.gmail.com` (or your provider)
   - **Port**: `587` (STARTTLS) or `465` (SSL)
   - **Username**: Your email
   - **Password**: **App password** (not main password!)
   - **From**: `Your Name <you@domain.com>`
   - **TLS/SSL**: Check only for port 465
3. Save → "Send Test Email"
4. Check inbox

> JobPilot only emails publicly listed, domain-verified recruiter addresses. No bulk campaigns.

---

## 5. Custom Domain (Optional)

1. Vercel → Project → Settings → Domains → Add
2. Enter your domain (e.g., `app.yourdomain.com`)
3. Add DNS records as shown:
   - Subdomain: `CNAME` → `cname.vercel-dns.com`
   - Apex: `A` → `76.76.21.21`
4. Wait for DNS propagation + Vercel certificate
5. Update `APP_URL` to `https://app.yourdomain.com` in **both** Vercel and worker
6. Redeploy both

---

## 6. Post-Deployment Verification

Run through this checklist:

- [ ] `GET /api/health` returns `{"status":"ok","database":"ok","ai":"configured"}`
- [ ] Register a new account → works
- [ ] Upload CV → parses correctly
- [ ] Run Discovery → fetches jobs from sources
- [ ] Match jobs → scores appear
- [ ] Tailor application → generates PDF/DOCX
- [ ] Approve application → state changes to "Approved"
- [ ] Submit via browser → worker picks up task
- [ ] Worker reports "applied" or "manual_required"
- [ ] Email integration → test email sends
- [ ] Settings → Browser Automation Worker shows "Online"
- [ ] Cron job works: `POST /api/cron/tick` with `CRON_SECRET`

---

## 7. Monitoring & Maintenance

### Logs
- **Vercel**: Functions → View logs
- **Supabase**: Logs → Database/Auth/Storage
- **Worker**: Render/Fly.io logs

### Database
- Monitor storage usage in Supabase
- Run `VACUUM ANALYZE` periodically if needed
- Backup: Supabase → Settings → Database → Backups

### Worker
- Check heartbeat: `GET /api/automation/worker`
- Monitor failed tasks in Automation page
- Screenshots saved to `SCREENSHOT_DIR` on worker

### Cron
- Vercel Hobby: Daily cron only (`vercel.json` schedules 8 AM UTC)
- For more frequent runs: External scheduler → `POST /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| `database: "error"` in health | Check `DATABASE_URL` format, SSL, session pooler port 5432 |
| Worker shows "offline" | Verify `WORKER_TOKEN` matches on both sides, check worker logs |
| Jobs not discovered | Check source adapters, verify `vercel.json` cron or external scheduler |
| PDF generation fails | Check `@napi-rs/canvas` native deps, verify storage bucket permissions |
| Login fails | Check `APP_ENCRYPTION_KEY` is set, cookies work on custom domain |

---

## 9. Security Checklist

- [ ] `APP_ENCRYPTION_KEY` is 32-byte hex, unique per environment
- [ ] `CRON_SECRET` is random, not shared
- [ ] `WORKER_TOKEN` is random, matches worker exactly
- [ ] `AI_API_KEY` has minimal permissions
- [ ] SMTP uses app password, not main password
- [ ] Supabase RLS policies enabled (migration 0002)
- [ ] Supabase Storage bucket is private
- [ ] Vercel deployment protection enabled if needed
- [ ] Custom domain uses HTTPS (Vercel auto-provisions)

---

## 10. Cost Estimation (Monthly)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Vercel | Hobby (free) | $0 |
| Supabase | Free tier (500MB DB, 1GB storage) | $0 |
| Render Worker | Starter ($7/mo) or Free (with spin-down) | $0-7 |
| Fly.io Worker | Shared CPU 1x, 1GB RAM | ~$5-10 |
| **Total** | | **$0-17/mo** |

> Free tiers are sufficient for personal use. Upgrade for production workloads.

---

## Quick Commands Reference

```bash
# Generate secrets
openssl rand -hex 32  # APP_ENCRYPTION_KEY, CRON_SECRET, WORKER_TOKEN

# Local development
npm run dev
npm run worker          # In-process scheduler
cd worker && uvicorn main:app --reload  # Playwright worker

# Test endpoints
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/dev/seed

# Deploy
npx vercel --prod
fly deploy  # or push to trigger Render
```

---

## Support

- Check `AGENTS.md` for development guidelines
- Check `ARCHITECTURE.md` for system design
- Check `AUTOMATION_POLICY.md` for permission model
- Issues: GitHub Issues on the repository