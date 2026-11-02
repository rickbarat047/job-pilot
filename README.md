# JobPilot AI

JobPilot AI is an autonomous, permission-controlled job discovery and application platform for candidates in India. It parses a CV once, discovers real vacancies from public ATS boards and remote job boards, scores them against the candidate's actual profile, and generates truthful, ATS-friendly application materials.

## Quick start

```bash
npm install
cp .env.example .env
# set APP_ENCRYPTION_KEY (generate with node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm run dev
```

Open http://localhost:3000, register, upload your CV, and run discovery.

Optional demo data:

```bash
curl -X POST http://localhost:3000/api/dev/seed
```

Demo account: `demo@jobpilot.ai` / `Demo@12345`.

## Tests

```bash
npm run test
npm run typecheck
npm run build
```

## Scheduler

The in-process scheduler handles discovery, verification, career-page checks, digests and auto-apply:

```bash
npm run worker
```

Browser applications are **not** handled here. They are claimed by the external Playwright worker described below.

## Environment

See `.env.example`. AI is optional: without `AI_API_KEY`, JobPilot uses its deterministic fallback engine. Email and browser automation are optional and disabled by default in demo mode.

Required production values:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public origin, e.g. `https://jobpilot-ai-sand.vercel.app` |
| `DATABASE_URL` | Supabase Postgres connection string (pooler, port 6543) |
| `APP_ENCRYPTION_KEY` | Encrypts SMTP credentials at rest |
| `CRON_SECRET` | Authenticates `/api/cron/tick` |
| `WORKER_TOKEN` | Shared secret for the Playwright worker |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Document/CV storage |

`DATABASE_PATH` and `STORAGE_DIR` are for local SQLite/filesystem use only.

## Architecture

- Next.js App Router frontend and API routes.
- SQLite for local development (`node:sqlite`); Postgres/Supabase in production. The same repository layer supports both.
- Modular job-source adapters in `src/lib/sources` (Greenhouse, Lever, Ashby, SmartRecruiters, Remotive, Himalayas, Jobicy, manual import).
- AI provider abstraction in `src/lib/ai` with a deterministic, truthful fallback.
- Permission-controlled application workflow in `src/lib/permissions.ts`.
- PDF/DOCX generation in `src/lib/documents`; OCR fallback for scanned CVs.
- Separate Python/Playwright worker in `worker/`.

## Deploy to Vercel + Supabase

1. Create a Supabase project. Run `supabase/migrations/0001_schema.sql` and `0002_rls.sql` in the SQL editor.
2. Create a storage bucket (default `jobpilot`) and keep it private.
3. In Vercel, set the environment variables above for **Production** and **Preview**. Use the Supabase pooler URL for `DATABASE_URL`.
4. Deploy:

```bash
npx vercel --prod
```

5. Confirm `GET /api/health` returns `{"status":"ok","database":"ok"}`.
6. `vercel.json` schedules `/api/cron/tick` once a day. Vercel Hobby only allows daily crons; for frequent discovery, call the same endpoint from an external scheduler with `CRON_SECRET`.

## SMTP setup

Open **Settings → Email integration** and enter:

- SMTP host and port (Gmail: `smtp.gmail.com`, `587` with STARTTLS; `465` with SSL).
- SMTP username and an **app password** (never the main account password).
- From address, e.g. `Your Name <you@example.com>`.
- Tick **Use TLS/SSL** only for port `465`.

Save, then **Send test email**. Credentials are encrypted with `APP_ENCRYPTION_KEY` and are never returned by the API. Removing the integration deletes the stored secret.

Email submission is approval-controlled. JobPilot only emails publicly listed, domain-verified recruiter addresses, never sends bulk campaigns, and attaches the tailored resume and cover letter.

## Browser automation worker

The worker is a long-running service that polls the app. It never receives database credentials or user session cookies.

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

Then check **Settings → Browser automation worker**. It should report **Online** within one poll interval.

Deployment options are documented in [`worker/README.md`](worker/README.md):

- **Render** — use the root `render.yaml` blueprint.
- **Fly.io** — use `worker/fly.toml` and `fly secrets set`.
- **Docker/VPS** — `docker build -t jobpilot-worker worker`.

Set `APP_URL` and `WORKER_TOKEN` on both the app and the worker. The worker polls outbound, so it works behind firewalls and does not need a public URL.

Safety rules enforced by the worker:

- Only **Approved** applications are eligible.
- Demo mode blocks browser submissions.
- CAPTCHA, MFA, login walls, account creation and unknown required questions stop the run and return the application to **Approved** as `manual_required`.
- Workday, iCIMS, Taleo and SuccessFactors usually require employer accounts, so the worker reports `manual_required` instead of guessing.
- Failures retry with exponential backoff and a maximum attempt count.
- Screenshots of failures are written to `SCREENSHOT_DIR` on the worker only.

## Custom domain

1. In Vercel → **Project → Settings → Domains**, add your domain (e.g. `app.yourdomain.com`).
2. Add the DNS records Vercel shows:
   - Subdomain: `CNAME` → `cname.vercel-dns.com`.
   - Apex domain: `A` → `76.76.21.21` (or the value Vercel displays).
3. Wait for DNS propagation and Vercel's certificate to become **Valid**.
4. Set `APP_URL` to the custom domain and redeploy. `APP_URL` is used for CSRF checks, document links and worker payloads.
5. Update the worker's `APP_URL` to the same value.

## Security and data

- Passwords use scrypt with per-user salts; sessions are HttpOnly cookies.
- SMTP credentials are AES-256-GCM encrypted.
- Worker endpoints require `WORKER_TOKEN` (constant-time comparison).
- RLS policies live in `supabase/migrations/0002_rls.sql`; the app uses the service role only on the server.
- Users can export or delete all data from **Settings → Data control**.
- JobPilot never fabricates experience, education, certifications or skills, never accepts offers, and never bypasses CAPTCHAs or login walls.
