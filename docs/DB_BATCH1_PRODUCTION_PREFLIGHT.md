# Database Batch 1 — Production Preflight (READ-ONLY)

This is a READ-ONLY preflight. No SQL, migrations, commits, pushes, or deployments were executed.

## What is already verified (local)

- Code changes compile: `npm run typecheck` PASS (0 errors).
- Tests: 77 passed, 3 skipped (runtime permission tests, UNVERIFIED — no PostgreSQL).
- Build: PASS.
- Migration files 0003 and 0004 are idempotent, non-destructive, and contain no `DROP`/`DELETE`/`auth.uid()`.
- Application code (`src/lib/db.ts`, `src/lib/storage.ts`, `src/lib/bootstrap.ts`) updated and consistent with the migration authority decision.
- No production access was performed.

## What remains unverified (manual, production)

- Application database role identity and privileges (owner/BYPASSRLS).
- Whether RLS is enabled on `push_subscriptions` in production.
- Whether FORCE RLS is disabled.
- Existing grants/policies on `push_subscriptions`.
- Migration history (whether 0001/0002 are applied; whether 0003/0004 are pending).
- Backup existence (DB + Storage).

---

## Where to run the read-only SQL

Use the **Supabase Dashboard → SQL Editor** of the production project, OR `psql` connected with the production `DATABASE_URL`. Run each query in a **new, separate query tab**. Do not run any DDL/DML (no CREATE/ALTER/DROP/INSERT/UPDATE/DELETE).

Share the **full result rows** (not screenshots of errors) for each query. Redact nothing except connection strings.

---

## Read-only SQL queries (copy-paste)

### Q1 — Current application database role
```sql
SELECT current_user AS current_role, session_user AS session_role;
```
**Share:** the role name (e.g. `postgres`, `supabase_admin`, or a custom app role).

### Q2 — Table owner
```sql
SELECT tableowner
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'push_subscriptions';
```
**Share:** the owner role name. If the table does not exist, this returns no rows (that is expected before migration).

### Q3 — Does the current role own the table?
```sql
SELECT (pg_get_userbyid(c.relowner) = current_user) AS owns_table
FROM pg_class c
WHERE c.relname = 'push_subscriptions' AND c.relnamespace = 'public'::regnamespace;
```
**Share:** `true` / `false` / no rows.

### Q4 — BYPASSRLS attribute of the current role
```sql
SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
```
**Share:** the boolean.

### Q5 — RLS enabled / forced status
```sql
SELECT relname,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS force_rls
FROM pg_class
WHERE relname = 'push_subscriptions'
  AND relnamespace = 'public'::regnamespace;
```
**Share:** both booleans (or no rows if the table is absent).

### Q6 — Existing policies
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.push_subscriptions'::regclass;
```
**Share:** list of policy names (expected: none).

### Q7 — Grants on the table
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'push_subscriptions';
```
**Share:** grantee/privilege pairs.

### Q8 — Effective access for anon/authenticated
```sql
SELECT has_table_privilege('anon', 'public.push_subscriptions', 'SELECT') AS anon_select,
       has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT') AS auth_select;
```
**Share:** both booleans.

### Q9 — Migration history
```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```
**Share:** the full list of applied migration versions.

### Q10 — All existing tables (for conflict check)
```sql
SELECT to_regclass('public.push_subscriptions') AS push_subscriptions_exists;
```
**Share:** `NULL` (table absent) or the regclass (table present).

---

## What to share with me

For each query Q1–Q10, paste the **result rows** (text, not screenshots). Do not include connection strings or credentials. With those results I can determine:
- Whether the application role owns/bypasses RLS (production compatibility).
- Whether RLS is already enabled (unexpected if yes).
- Whether any grants/policies already exist.
- Which migrations are applied and which are pending.

## Supabase CLI migration verification

Run these from the repository root (after `supabase login` and `supabase link` to the production project):

```bash
# 1. Inspect remote migration history
supabase migration list --remote

# 2. Dry run: show exactly which migrations would be applied, without applying them
supabase db push --remote --dry-run

# 3. (After approval) Apply pending migrations
supabase db push --remote
```

**How to interpret:**
- `migration list --remote` shows applied vs. pending. Confirm `0001_schema` and `0002_rls` are applied.
- `--dry-run` lists the exact set of migrations that would be applied. Confirm only `0003_push_subscriptions` and `0004_push_subscriptions_rls` are pending. If any other migration appears, stop and investigate before applying.
- Only proceed with `db push --remote` after the dry-run output matches expectations and a backup is confirmed.

## Backup verification (manual)

- **Database:** Supabase Dashboard → Database → Backups. Confirm the most recent backup timestamp is recent (within your RPO). Note: Supabase automated backups are plan-dependent (Pro plan provides daily backups + PITR).
- **Storage:** Supabase Dashboard → Storage → `jobpilot` bucket. Database backups do **not** include Storage API file objects. Verify storage backup coverage separately (Supabase Storage backups if enabled on the plan, or manual export). Missing storage backups are a separate risk.

## Exact actions you must perform

1. Run Q1–Q10 in the Supabase SQL editor (read-only). Share the result rows.
2. Verify a recent database backup (and storage backup) exists.
3. Run `supabase migration list --remote` and `supabase db push --remote --dry-run`. Share the dry-run output.
4. Provide the above evidence. I will then give a final go/no-go for applying the migration.

## What is verified (local)

- Code compiles: typecheck 0 errors.
- Tests: 77 passed, 3 skipped (runtime permission tests, UNVERIFIED).
- Build: PASS.
- Migration files are idempotent, non-destructive, no `auth.uid()`, no `FORCE RLS`.

## What remains unverified (production)

- Application database role identity/privileges.
- RLS enabled status and FORCE RLS state.
- Existing grants/policies on `push_subscriptions`.
- Migration history.
- Backup existence (DB + Storage).

## Do not

- Execute any DDL/DML against production.
- Apply migrations.
- Change production environment variables.
- Commit, push, or deploy.

Awaiting your evidence before production approval.