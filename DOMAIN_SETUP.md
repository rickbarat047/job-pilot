# Custom domain setup (Vercel + DNS)

1. Vercel → project `jobpilot-ai` → **Settings → Domains → Add** → enter your domain (e.g. `jobpilot.ai` and `www.jobpilot.ai`).
2. Vercel shows the DNS records to add. At your registrar, add:
   - `A` record: `@` → `76.76.21.21`
   - `CNAME`: `www` → `cname.vercel-dns.com`
   (Vercel's UI gives the exact values; use those.)
3. Wait for "Valid Configuration" in Vercel (usually 1–10 min).
4. Set env var `NEXT_PUBLIC_SITE_URL=https://jobpilot.ai` (Production) in Vercel.
5. Redeploy (`npx vercel --prod --yes --token ...`).
6. Update Google Search Console with the new sitemap URL: `https://jobpilot.ai/sitemap.xml`.

All site-URL references in the app read from `NEXT_PUBLIC_SITE_URL` (layout metadata, sitemap, robots, OG image), so no code change is needed.
