# Database backups

## Automated (GitHub Actions)
`.github/workflows/backup.yml` runs weekly (Sunday 03:00 UTC) and uploads a dump
as a GitHub Actions artifact (retained 30 days). Trigger manually:
repo → Actions → "Database backup" → Run workflow.

Requires secret `DATABASE_URL` (Postgres) or `DATABASE_PATH` (SQLite) on GitHub.

## Manual
```bash
# Postgres
DATABASE_URL="postgres://..." node scripts/backup-db.mjs --out ./backups

# SQLite
DATABASE_PATH="./data/jobpilot.db" node scripts/backup-db.mjs --out ./backups
```

## Supabase (production)
Supabase has built-in daily backups (Pro plan) and point-in-time recovery.
For the free tier, rely on the GitHub Actions weekly backup above.

## Restore
- Postgres: `psql "$DATABASE_URL" < jobpilot-backup-*.sql`
- SQLite: replace the DB file (stop the app first).