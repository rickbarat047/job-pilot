# Database backups

JobPilot production uses **PostgreSQL (Supabase)**. Backups are PostgreSQL-only:
there is deliberately **no SQLite fallback** in the backup path. A missing or
invalid `DATABASE_URL` fails the job with a non-zero exit code.

## Architecture

- `scripts/backup-lib.mjs` — pure, tested helpers for URL validation, credential
  redaction, artifact validation, manifests, retention and restore-safety guards.
- `scripts/backup-db.mjs` — runs `pg_dump --format=custom` through `PG*`
  environment variables (never a DSN in argv), verifies the dump with
  `pg_restore -l`, and writes a JSON manifest with timestamps, size, sha256,
  source row counts and verification status.
- `scripts/verify-backup.mjs` — restores a dump into a **different, non-production
  database** and checks essential tables, row counts, migration-added objects and
  migration compatibility. It requires `RESTORE_VERIFY=1`, refuses
  `NODE_ENV=production`, and refuses a target pointing at the source database.
- `.github/workflows/backup.yml` — weekly production backup job that fails closed
  when the `DATABASE_URL` secret is missing, plus a separate job that proves a real
  PostgreSQL backup and isolated restore using a disposable Postgres service.

Credentials are never printed or written to a manifest. GitHub artifact storage
is the primary retention mechanism (30 days by default); local pruning is opt-in
via `BACKUP_PRUNE=1` and only removes files named `jobpilot-backup-*`.

## Automated backups

Schedule: weekly, Sunday 03:00 UTC. Manual trigger: repo → Actions →
"Database backup" → Run workflow.

Required GitHub Actions secret: **`DATABASE_URL`** (a PostgreSQL connection URL).
`DATABASE_PATH` is no longer used and must not be configured. Artifacts are
named `jobpilot-db-backup-<run_id>` and retained for 30 days. The workflow uses
`permissions: contents: read` and a non-cancelling concurrency group so two
backups cannot overwrite one another.

> Operator action required: add a PostgreSQL `DATABASE_URL` secret to the GitHub
> repository. Until then the production backup job fails closed by design.

## Manual backup

```bash
DATABASE_URL="postgres://..." node scripts/backup-db.mjs --out ./backups
```

The script writes two files:

- `jobpilot-backup-<timestamp>.dump` — pg_dump custom-format archive.
- `jobpilot-backup-<timestamp>.dump.manifest.json` — non-sensitive metadata.

Useful environment variables:

| Variable | Meaning | Default |
| --- | --- | --- |
| `DATABASE_URL` / `POSTGRES_URL` | PostgreSQL connection URL (required) | — |
| `DATABASE_SSL=false` | Disable SSL for local test databases | SSL required |
| `BACKUP_DIR` | Output directory when `--out` is omitted | `./backups` |
| `BACKUP_RETENTION_DAYS` | Local prune window | `30` |
| `BACKUP_PRUNE=1` | Enable local pruning | disabled |

## Isolated restore verification

Never restore into production. Use a disposable database:

```bash
RESTORE_VERIFY=1 \
DATABASE_URL="postgres://...source..." \
RESTORE_VERIFY_URL="postgres://...disposable-target..." \
NODE_ENV=test \
node scripts/verify-backup.mjs \
  --file ./backups/jobpilot-backup-<timestamp>.dump \
  --manifest ./backups/jobpilot-backup-<timestamp>.dump.manifest.json
```

Use a PostgreSQL server at least as new as the `pg_dump` client. Newer clients
emit settings such as `SET transaction_timeout = 0` that older servers reject;
the disposable verification job therefore uses `postgres:17`.

Verification checks: pg_dump magic + size, `pg_restore -l` table of contents,
essential tables from `supabase/migrations/0001_schema.sql` and
`0003_push_subscriptions.sql`, row counts against the manifest, and clean
application of the additive migrations on top of the restored data.

## Supabase (production)

Supabase Pro includes daily backups and point-in-time recovery. These GitHub
backups are an additional, independently restorable copy. To restore manually
into an empty database:

```bash
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname "<disposable-database>" jobpilot-backup-<timestamp>.dump
```

## Verification evidence

See `OPENCODE_PROJECT_RECOVERY.md` for the recorded local and GitHub Actions
verification results. Production backup evidence depends on the manual secret
configuration described above; the isolated restore job runs on every workflow
invocation without production access.

## What changed from the old behaviour

- Removed the silent SQLite fallback that caused weekly failures.
- Removed DSN shell interpolation from `pg_dump`.
- Added integrity checks, manifests, non-zero exits, retention and isolated
  restore verification.
