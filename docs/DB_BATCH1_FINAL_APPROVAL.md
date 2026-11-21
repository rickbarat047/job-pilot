# Database Batch 1 — Final Approval

Review-only. No SQL, code, or configuration was changed. No migrations applied.

## 1. Database role compatibility

### Expected application role (from code)
- `src/lib/db.ts` connects via `pg` `Pool` using `DATABASE_URL` (or `POSTGRES_URL`). The role is whatever the connection string's user specifies.
- The app runs `SELECT/INSERT/UPDATE/DELETE` against `push_subscriptions` through `run`/`get`/`all` (parameterized). It relies on the connected role having standard table privileges.
- The connected role's identity, ownership, and `BYPASSRLS` status **cannot be verified** from this environment (credentials hidden; no DB access).

### Read-only SQL for manual verification (do not modify)

```sql
-- Current session role
SELECT current_user, session_user;

-- Table owner
SELECT tableowner FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'push_subscriptions';

-- Does the current role own the table?
SELECT (pg_get_userbyid(relowner) = current_user) AS owns_table
FROM pg_class WHERE relname = 'push_subscriptions';

-- BYPASSRLS attribute of current role
SELECT rolname, rolbypassrls
FROM pg_roles WHERE rolname = current_user;

-- RLS enabled / forced status
SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity AS force_rls
FROM pg_class WHERE relname = 'push_subscriptions';

-- Current grants on the table
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'push_subscriptions';

-- Effective access for anon/authenticated
SELECT has_table_privilege('anon', 'public.push_subscriptions', 'SELECT') AS anon_select,
       has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT') AS auth_select;
```

### Impact assessment
- If the application role is the table owner or has `BYPASSRLS`: enabling RLS (without FORCE) does not affect app CRUD. ✅ Expected for Supabase `postgres`/service roles.
- If the application role is neither owner nor BYPASSRLS: enabling RLS with default-deny (no policies) would block all app CRUD → **production outage**. This is the unverified risk.
- The migration does not enable `FORCE ROW LEVEL SECURITY`, so owners/privileged roles bypass RLS. This is intentional and safe for the trusted server connection.
- Revoking `anon`/`authenticated` only affects those roles, not the app's connection (assuming the app uses a different role).

**Conclusion:** Production runtime compatibility is **UNVERIFIED** until the read-only queries above are run against the production database.

## 2. Migration correctness

### Order
1. `0003_push_subscriptions.sql` (table + index)
2. `0004_push_subscriptions_rls.sql` (RLS + revoke)

Correct and sequential. 0004 depends on 0003 (table must exist). ✅

### 0004 contents review
| Requirement | Status |
|---|---|
| Enables RLS on `push_subscriptions` | ✅ `alter table ... enable row level security` |
| No `FORCE ROW LEVEL SECURITY` | ✅ absent |
| No `auth.uid()` policies | ✅ no `CREATE POLICY` at all |
| No destructive operations | ✅ no DROP/DELETE/UPDATE |
| No data modification | ✅ none |
| Revokes only `anon` and `authenticated` | ✅ `revoke all ... from anon/authenticated` |
| Trusted app role preserved | ✅ revokes target only public-facing roles; owner/privileged bypass RLS |

### 0003 contents review
- `CREATE TABLE IF NOT EXISTS` with correct columns, PK, FK (cascade), unique, index. ✅
- Idempotent. ✅

## 3. Test coverage

### Static SQL tests (`push-subscriptions-rls.test.ts`)
- 6 tests verifying migration enables RLS, no `auth.uid()`, no FORCE RLS, no drop/recreate, revoke anon/authenticated, no permissive policy. ✅ Genuine static checks.

### Application-level tests
- 1 test verifying `subscribe/route.ts` filters by `user_id` and uses `requireApiUser`. ✅

### PostgreSQL integration tests
- 3 tests are `it.skip` (UNVERIFIED): anon denial, authenticated denial, app role functionality. Marked skipped because no PostgreSQL instance is available. **Not counted as passed.**

### Other tests
- `schema-consistency.test.ts`: verifies migration file exists, contains FK/cascade/unique, and that bootstrap no longer duplicates the definition. ✅

**Summary:** 77 passed, 3 skipped (UNVERIFIED). No skipped test is reported as passed.

## 4. Deployment safety — read-only SQL

See section 1 for the full read-only SQL set. Additional:

```sql
-- Confirm no existing RLS policy on push_subscriptions
SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
FROM pg_policy WHERE polrelid = 'public.push_subscriptions'::regclass;

-- Confirm migration history
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

## 5. Final verdict

**VERDICT: READY FOR STAGING, BLOCKED FOR PRODUCTION**

### Evidence
- Code and migration implementation is correct and minimal.
- All local checks pass (typecheck 0 errors, 77 tests passed + 3 skipped, build passes).
- No destructive SQL; idempotent DDL; default-deny RLS; no `auth.uid()`.
- Revocations target only `anon`/`authenticated`.

### Conditions for production (not yet met)
1. **Database role compatibility UNVERIFIED** — must run the read-only SQL in section 1 against production to confirm the app role owns (or bypasses RLS on) `push_subscriptions`. If the app role is neither owner nor privileged, enabling RLS will break production CRUD.
2. **Migration not applied** — must apply 0003 + 0004 via `supabase db push --remote` (after backup and dry-run).
3. **Backup unverified** — must confirm a recent backup (and storage backup coverage) before migration.
4. **Storage backup** — Supabase DB backups do not include Storage API file objects.

### Required next steps (manual, in order)
1. Run read-only role/RLS/grant queries (section 1 & 4) against production.
2. Confirm backup exists (DB + storage).
3. `supabase migration list --remote` → verify 0001, 0002 applied.
4. `supabase db push --remote --dry-run` → confirm only 0003 + 0004 pending.
5. `supabase db push --remote` → apply.
6. Post-migration read-only verification (RLS enabled, no policies, grants correct).
7. Commit/push/deploy per the preflight plan.

No production changes, commits, pushes, or deployments were made. STOP.