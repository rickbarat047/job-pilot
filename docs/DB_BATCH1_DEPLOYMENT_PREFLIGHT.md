# Database Batch 1 — Production Deployment Preflight

READ-ONLY PREFLIGHT. No migrations, commits, pushes, or deployments were executed.

## 1. Git verification

- Current branch: `main`
- Remote: `origin` → `https://github.com/rickbarat047/job-pilot.git`
- Working tree: modified (DB Batch 1 changes + audit/recovery docs), no commit yet.
- Latest commit: `6b99bd4` (worker fix + docs).

Outstanding (uncommitted) files:
```
 M docs/RECOVERY_PROGRESS.md
 M scripts/setup-supabase.js
 M src/lib/bootstrap.ts
 M src/lib/db.ts
 M src/lib/storage.ts
?? docs/DB_AUTH_AUDIT.md
?? docs/DB_BATCH1_CODE_REVIEW.md
?? docs/DB_RECOVERY_PROGRESS.md
?? src/lib/db-config.test.ts
?? src/lib/schema-consistency.test.ts
?? src/lib/storage-config.test.ts
?? supabase/migrations/0003_push_subscriptions.sql
?? supabase/migrations/0004_push_subscriptions_rls.sql
```

All DB Batch 1 changes are present locally on `main`.

## 2. Supabase production verification

**Status: UNVERIFIED (read-only access unavailable from this environment).**

The Vercel CLI cannot pull secret values (they are marked `[SENSITIVE]`), so `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc. cannot be read here. Production database inspection therefore requires manual access.

### Manual verification steps (read-only, no writes)

Connect to the production Postgres database using the value of `DATABASE_URL` from Vercel (Project Settings → Environment Variables) via `psql` or the Supabase SQL editor, then run:

```sql
-- Existing tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Does push_subscriptions already exist?
SELECT to_regclass('public.push_subscriptions');

-- If it exists, inspect columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
ORDER BY ordinal_position;

-- Indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'push_subscriptions';

-- Foreign keys
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.push_subscriptions'::regclass;

-- Migration history (if a migrations table exists)
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;
```

Record results without modifying anything. Do not run any DDL/DML.

## 3. Migration verification

`supabase/migrations/0003_push_subscriptions.sql`:

```sql
create table if not exists public.push_subscriptions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);
```

Checks:
- Target schema: `public` ✅
- Foreign key: `users(id)` ✅
- `ON DELETE CASCADE`: ✅
- `UNIQUE(user_id, endpoint)`: ✅
- Index: `idx_push_subscriptions_user` on `user_id` ✅
- Safe creation: `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` → idempotent, no drop, no overwrite ✅
- Conflict risk: only if `push_subscriptions` already exists with an incompatible definition. The read-only query above (`to_regclass`) determines this. If it exists with the same columns, the migration is a no-op. If it exists with different columns, manual reconciliation is needed before applying.

### Preferred migration execution: Supabase CLI (not manual SQL)

Applying SQL directly through the Supabase SQL Editor does **not** reconcile migration history. The `supabase_migrations.schema_migrations` table would not record `0003`, leaving the history inconsistent and causing future `supabase db push` runs to re-attempt or skip unpredictably. Use the Supabase CLI workflow instead.

CLI sequence (run from the repository root, after `supabase login` and `supabase link` to the production project):

```bash
# 1. Inspect remote migration history
supabase migration list --remote

# 2. Verify 0001 and 0002 are recorded as applied
#    (output should list 0001_schema and 0002_rls as applied)

# 3. Review the pending 0003 migration locally
cat supabase/migrations/0003_push_subscriptions.sql

# 4. DRY RUN: show exactly which migrations would be applied, without applying them
supabase db push --remote --dry-run

# 5. Push pending migrations to the remote database (only after dry-run matches expectations)
supabase db push --remote

# 6. Post-migration schema verification (read-only)
#    Run via Supabase SQL editor or psql:
SELECT to_regclass('public.push_subscriptions');
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='push_subscriptions';
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='push_subscriptions';
```

`supabase db push --remote` applies only pending migrations and records them in `schema_migrations`, keeping history consistent.

## 4. Production deployment plan

### Step 1 — Backup verification
- **Status: UNVERIFIED.** No backup evidence was found in the repository or environment.
- Supabase provides automated daily backups for Pro plans and point-in-time recovery; verify the most recent backup timestamp in Supabase Dashboard → Database → Backups.
- **Important:** Supabase database backups do **not** include Storage API file objects. The `jobpilot` storage bucket (resumes, generated documents) is backed up separately by Supabase Storage (if enabled on the plan) or must be backed up manually. Verify storage backup coverage before proceeding; missing storage backups are a separate risk from database backups.
- Do NOT proceed with the migration until a database backup is confirmed.

### Step 2 — Migration execution (Supabase CLI, after backup confirmed)
Follow the CLI sequence in section 3. Do not use the SQL Editor as the primary path.

### Step 3 — Schema verification (read-only, post-migration)
Run the read-only queries in section 3 step 5.

### Step 4 — Git commit (after migration verified)
Stage **only** the reviewed Batch 1 files — do not use `git add -A`. Preserve any unrelated changes.

```bash
git add docs/RECOVERY_PROGRESS.md
git add scripts/setup-supabase.js
git add src/lib/bootstrap.ts
git add src/lib/db.ts
git add src/lib/storage.ts
git add docs/DB_AUTH_AUDIT.md
git add docs/DB_BATCH1_CODE_REVIEW.md
git add docs/DB_RECOVERY_PROGRESS.md
git add src/lib/db-config.test.ts
git add src/lib/schema-consistency.test.ts
git add src/lib/storage-config.test.ts
git add supabase/migrations/0003_push_subscriptions.sql
git add supabase/migrations/0004_push_subscriptions_rls.sql
# (Add any other Batch 1 files explicitly if present.)

# Verify the staged set before committing
git diff --cached --stat
git diff --cached

git commit -m "Database recovery batch 1: fail-closed providers, push_subscriptions migration, non-destructive setup"
```

### Step 5 — Git push to main
```bash
git push origin main
```
(No force push. No reset.)

### Step 6 — Vercel deployment
```bash
npx vercel --prod --yes --token <VERCEL_TOKEN>
```
Then verify: `vercel inspect <deployment> --token <VERCEL_TOKEN>` → status `● Ready`, and `curl https://jobpilot-ai-sand.vercel.app/api/health` → `database: ok`.

### Step 7 — Production smoke tests
Read-only:
- `/api/health` → `status: ok`, `database: ok`.

Write test (not read-only — use a dedicated test account and test subscription, then clean up safely):
- Register a dedicated test user (not the owner's account).
- Perform a push subscribe round-trip (creates a row in `push_subscriptions`).
- Verify the row exists via read-only query.
- Perform the matching unsubscribe (deletes the row).
- Confirm cleanup (row removed).
- Delete the test account or leave it clearly marked as test data.

## 5. Final report

### Production database identity
- Provider: PostgreSQL (via `DATABASE_URL` in Vercel production env).
- Host/DB name: **UNVERIFIED** (secret; manual access required). Vercel env list confirms `DATABASE_URL` is set.

### Backup status
- **UNVERIFIED.** No backup evidence found in repo or environment. Must be confirmed before migration.
- Database backups do not include Storage API file objects; verify storage backup coverage separately.

### Existing migration history
- **UNVERIFIED** (manual access required). Expected: `0001_schema`, `0002_rls` applied; `0003_push_subscriptions` and `0004_push_subscriptions_rls` pending.

### Existing push_subscriptions status
- **UNVERIFIED.** Run `SELECT to_regclass('public.push_subscriptions');` manually.

### Migration safety assessment
- Safe: idempotent DDL, no drops, no overwrites, correct FK/cascade/unique/index. Conflict risk only if an incompatible `push_subscriptions` already exists (check via read-only query).

### Files to commit
```
 M docs/RECOVERY_PROGRESS.md
 M scripts/setup-supabase.js
 M src/lib/bootstrap.ts
 M src/lib/db.ts
 M src/lib/storage.ts
?? docs/DB_AUTH_AUDIT.md
?? docs/DB_BATCH1_CODE_REVIEW.md
?? docs/DB_RECOVERY_PROGRESS.md
?? src/lib/db-config.test.ts
?? src/lib/schema-consistency.test.ts
?? src/lib/storage-config.test.ts
?? supabase/migrations/0003_push_subscriptions.sql
?? supabase/migrations/0004_push_subscriptions_rls.sql
```

### Remaining blockers
1. **Backup unverified** — must confirm before migration.
2. **Production DB read-only access** — manual (Supabase dashboard/psql) required to inspect existing tables and `push_subscriptions`.
3. **Migration not yet applied** — manual step after backup.
4. **WORKER_TOKEN** — resolved (browser worker now succeeds after token alignment).

### STOP
Awaiting explicit production deployment approval. No write operations, commits, pushes, or deployments were performed.