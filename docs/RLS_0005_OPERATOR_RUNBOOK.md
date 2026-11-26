# Migration 0005 — RLS hardening: operator runbook

**Artifact:** `supabase/migrations/0005_rls_hardening.sql`
**Baseline:** `b5bc03c`
**Audience:** authorized production operator only
**Status:** validated on a disposable PostgreSQL 17 database. **Not applied to production.**

> **Read this first.** CI passing (`.github/workflows/ci.yml`, `.github/workflows/e2e.yml`)
> proves the migration is syntactically valid and behaves correctly on a
> **disposable** database. It is **not** production readiness. Nothing in this
> repository applies database changes automatically to production. Every
> production action below requires an **authorized operator** with credentials
> supplied through the organization's secret store. No agent, test, workflow,
> script in this repo, or command in this document may connect to the production
> database on your behalf.

---

## 1. Non-negotiable rules

| Rule | Detail |
| --- | --- |
| Production access is operator-only | Only an authorized operator may inspect, back up, apply, verify or roll back production. Agents and CI never connect to production. |
| Never print secrets | Supply credentials via `PG*` environment variables populated from the secret store. Never paste a DSN into shell history, a ticket, a log, or this runbook. Never echo the variables. |
| CI is not production readiness | A green E2E/CI run is a *precondition*, not authorization. The change ticket must carry operator approval and verified backup evidence. |
| Verify target identity before every command | Confirm host, port, database name and role from the operator console/secret store metadata — never infer it from a local config file or `.env`. |
| No broad grants as a shortcut | Do not "fix" an application error by adding permissive policies on protected tables or by granting to `anon`/`authenticated`. Escalate instead. |
| 0005 is non-destructive | It only enables RLS and revokes privileges. It does not drop tables, change data, or enable `FORCE ROW LEVEL SECURITY`. |

---

## 2. What 0005 actually does

```sql
alter table public.users                  enable row level security;
alter table public.company_career_pages   enable row level security;
alter table public.worker_status          enable row level security;
alter table public.app_meta               enable row level security;
alter table public.company_reviews        enable row level security;

revoke all on public.users                from anon, authenticated;
revoke all on public.company_career_pages from anon, authenticated;
revoke all on public.worker_status        from anon, authenticated;
revoke all on public.app_meta             from anon, authenticated;
revoke all on public.company_reviews      from anon, authenticated;
```

Security model:

- **RLS enabled, zero policies** → default-deny for any non-bypassing role, including
  `anon` and `authenticated`, even if a privilege is later re-granted.
- **Privileges revoked** → defense in depth; public roles cannot even reach the table.
- **`FORCE ROW LEVEL SECURITY` is deliberately NOT enabled** → the table owner and
  privileged roles (superuser / `service_role` with `BYPASSRLS`) continue to bypass
  RLS. This is what keeps the trusted server-side application working.
- The migration is **idempotent**: re-running `enable row level security` and
  `revoke all` is harmless. A partial failure can be fixed and the file re-run.

---

## 3. Findings: legitimate application access to the protected tables

This is the result of a read-only audit of `src/`, `scripts/setup-supabase.js` and
the routes. **No application code accesses these tables through Supabase
PostgREST with the `anon` or `authenticated` key.** All data access goes through
the direct Postgres pool in `src/lib/db.ts` (`get` / `run` / `all` /
`transaction`) using `DATABASE_URL` / `POSTGRES_URL`. The only `@supabase/supabase-js`
client is in `src/lib/storage.ts` and is used exclusively for **object storage**
(`.storage.from(bucket)`), never for database tables (`0005` does not touch
storage).

| Protected table | Legitimate app call sites (all via direct `DATABASE_URL` connection) | Effect of 0005 |
| --- | --- | --- |
| `users` | `src/lib/auth.ts` (register/login/lookup/count), `src/lib/transactional-email.ts`, `src/lib/seed.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/settings/account/route.ts` (soft delete), `src/app/api/admin/users/route.ts`, `src/app/api/cron/tick/route.ts` (batch iteration), `src/lib/bootstrap.ts` (column migration) | **None**, provided the app connects as table owner / superuser / `BYPASSRLS` role. Blocks direct anon reads of `password_hash`. |
| `company_career_pages` | `src/lib/bootstrap.ts` (seed/upsert), `src/lib/companies/check.ts` (status updates) | **None** for the trusted connection. |
| `worker_status` | `src/lib/bootstrap.ts` (seed), `src/lib/automation.ts` (heartbeat upsert/read), `src/lib/repositories.ts` (worker state), E2E `TRUNCATE` in `scripts/e2e/run.mjs` | **None** for the trusted connection. |
| `app_meta` | `src/lib/bootstrap.ts` (`bootstrapped` marker), `src/app/api/cron/tick/route.ts` (`cron_cursor` read/upsert/update) | **None** for the trusted connection. |
| `company_reviews` | `src/app/api/companies/[id]/reviews/route.ts` (GET/POST/PUT), created at runtime by `src/lib/bootstrap.ts` and `src/lib/schema.ts` | **None** for the trusted connection. |

Additional findings that affect execution:

1. **`company_reviews` is NOT created by any versioned migration.** It exists only
   through `src/lib/schema.ts` / `src/lib/bootstrap.ts`. If the target database has
   never run application bootstrap, `alter table public.company_reviews ...` will
   fail. Preflight must confirm the table exists (see §5). Do not edit 0005 to work
   around this.
2. `scripts/setup-supabase.js` applies migrations `0001`→`0005` in order and no
   longer contains `GRANT ALL ON SCHEMA public TO PUBLIC`. `ARCHITECTURE.md`
   identifies `supabase/migrations` as the authoritative production schema path.
3. `0004_push_subscriptions_rls.sql` already hardens `push_subscriptions` the same
   way; 0005 extends that pattern to the five remaining privileged/system tables.
4. **Residual risk:** if any deployment connects to Postgres with a non-owner,
   non-superuser role that lacks `BYPASSRLS`, 0005 will break that deployment's
   writes to these five tables. Verify the app connection identity in §5.

---

## 4. Disposable validation evidence (already performed)

Test: `src/lib/rls-validation.test.ts`. It is **opt-in**: the live block only runs
when `RLS_TEST_DATABASE_URL` is set, and a guard rejects every non-loopback host
before any connection is attempted. The probe runs entirely inside **one
transaction that is always rolled back** — it creates `anon`, `authenticated` and
`service_role`, re-grants broad access, seeds sentinel rows, applies the real
0005 file, runs the assertions, then rolls back all of it.

Observed on the disposable PostgreSQL 17.12 database at `127.0.0.1:55432`
(`jobpilot_e2e`), baseline 0001+0003 applied:

- RED (unimplemented probe): 7 passed, 5 live tests failed via the intentional
  stub error.
- GREEN after implementation: **12 passed / 12**.
- With no `RLS_TEST_DATABASE_URL`: 11 passed, 5 live tests skipped (safe default).
- Post-run inspection confirmed: no residual `anon`/`authenticated`/`service_role`
  roles, all five `relrowsecurity` flags unchanged (`false`), zero sentinel rows.

Proven assertions:

- Precondition: `anon` could read a sentinel row **before** 0005 (non-vacuous baseline).
- After 0005: RLS is on for all five tables; `anon` and `authenticated` are denied
  SELECT, INSERT and UPDATE on all five (10 role×table cases × 3 verbs).
- `postgres` (models the direct `DATABASE_URL` owner/superuser connection) and
  `service_role` (BYPASSRLS) can still SELECT, INSERT and UPDATE all five.
- With SELECT re-granted to `anon`, RLS alone still hides every sentinel row
  (defense-in-depth check).

No production database, credential, secret, customer record or real email was
used. The disposable database is not a production readiness signal.

---

## 5. Production preflight checks (operator, read-only)

Record every result in the change ticket. **Stop and escalate if any check fails.**

### 5.1 Authorization and change control

- [ ] Change ticket exists with an approved window, named operator and named rollback owner.
- [ ] Operator has confirmed the target from the secret store / provider console metadata.
- [ ] CI and disposable validation for this commit are green (necessary, not sufficient).
- [ ] Stakeholders notified; application deploy frozen during the window.

### 5.2 Target identity (from an operator session; do not print secrets)

```sql
select current_database(), current_user, inet_server_addr(), inet_server_port();
```

Confirm the returned database/host match the approved production target and that
you are **not** connected to a local or disposable instance.

### 5.3 Baseline objects

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('users','company_career_pages','worker_status','app_meta',
                    'company_reviews','push_subscriptions')
order by 1;
```

- [ ] All six tables exist. In particular **`company_reviews` must exist** — see §3.
  If missing, stop and run the application bootstrap path or the canonical DDL
  from `src/lib/schema.ts` under separate approval before retrying.
- [ ] Migrations 0001–0004 are known-applied (Supabase migration history or provider
  dashboard). Do not re-run 0001–0004 as part of this change.

### 5.4 Current RLS / policy / owner state — **capture this output for rollback**

```sql
select relname, relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) as owner
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('users','company_career_pages','worker_status','app_meta','company_reviews')
order by relname;

select tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('users','company_career_pages','worker_status','app_meta','company_reviews');

select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname in ('anon','authenticated','service_role', current_user);

select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('users','company_career_pages','worker_status','app_meta','company_reviews')
  and grantee in ('anon','authenticated','service_role','PUBLIC')
group by table_name, grantee
order by table_name, grantee;
```

- [ ] Expected baseline for a vulnerable pre-0005 database: `relrowsecurity = false`
      on the five tables; no policies; `anon`/`authenticated` roles present.
- [ ] **Save the complete privileges output.** Rollback in §8 restores exactly
      these grants. If it is not captured, rollback cannot be exact.
- [ ] If `anon` or `authenticated` roles do not exist, 0005's `revoke ... from anon`
      will error. Stop and confirm the real role names with the provider.

### 5.5 Application connection identity

Run from a session using the **same credentials as the application**:

```sql
select current_user,
       (select rolsuper     from pg_roles where rolname = current_user) as is_superuser,
       (select rolbypassrls from pg_roles where rolname = current_user) as bypasses_rls;
```

- [ ] `is_superuser = true`, or the role is the table owner from §5.4, or
      `bypasses_rls = true`. Otherwise 0005 **will** break app writes — stop.
- [ ] Code audit reconfirmed: no `supabase.from(<table>)` database calls exist in
      `src/` (Supabase client is storage-only). See §3.

### 5.6 Backup gate

See §6. **No verified backup → no migration.**

---

## 6. Required VERIFIED backup evidence

A backup is not evidence until it has been **restored into a different,
disposable database and verified**. The project tooling is documented in
`BACKUP.md` and `.github/workflows/backup.yml`.

Required evidence, all attached to the change ticket:

1. **Fresh production dump** taken inside the change window using
   `scripts/backup-db.mjs` (custom-format `pg_dump`, `pg_restore -l` verified,
   JSON manifest with timestamp, size, sha256, source row counts and
   verification status). Store the dump/manifest outside production.
2. **Isolated restore verification** with `scripts/verify-backup.mjs`:
   `RESTORE_VERIFY=1`, `NODE_ENV=test`, source ≠ target, target is a disposable
   Postgres 17 database. All essential-table, row-count and migration-compatibility
   checks must pass. Never restore into production.
3. **Recorded identifiers**: backup filename, timestamp, sha256, verification
   status, workflow run ID, and the operator who verified them.
4. **Operator sign-off** that the evidence above corresponds to the production
   database being changed.

> **Important honesty note:** the evidence currently recorded in `BACKUP.md`
> (workflow run `45650808073`, commit `ddd0d6c`, sha256
> `017e6a343cf96c5c974d4847c573f7f7ce6fcb44665f9fe47f9d917ac5a58932`) was
> produced from a **seeded non-production** source database. In that same run
> the production backup job **failed closed** because the `DATABASE_URL` secret
> was not configured. That evidence proves the *tooling* works; it is **not**
> a production backup and does **not** satisfy this gate. Obtain a fresh,
> verified production backup before proceeding.

**STOP condition:** if `scripts/backup-db.mjs` cannot reach production with the
supplied secret, or isolated restore verification fails, or the production
backup job is failing closed — do not apply 0005.

---

## 7. Exact migration execution (authorized operator only)

Populate credentials from the secret store into environment variables; never
type a DSN into the shell or a shared document. Example shape (values omitted):

```bash
export PGHOST='<from-secret-store>'
export PGPORT='<from-secret-store>'
export PGUSER='<from-secret-store>'
export PGDATABASE='<from-secret-store>'
# export PGPASSWORD='<from-secret-store>'   # set only inside the operator shell; never echo
```

Preferred path (versioned migration, checked-out clean tree at the approved commit):

```bash
git rev-parse --short HEAD          # must equal the approved commit
supabase db push                    # applies pending migrations including 0005
```

Alternative path (explicit single-file apply; use if the provider has no
Supabase CLI link). Re-run read-only §5.2 identity check immediately before:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/migrations/0005_rls_hardening.sql
```

Rules:

- Apply **only** `0005_rls_hardening.sql`. Do not re-run 0001–0004 and do not
  run `scripts/setup-supabase.js` against production unless separately approved
  (it re-applies all migrations and also touches the storage bucket).
- Expect five `ALTER TABLE` and five `REVOKE` statements. Any error aborts the
  step under `ON_ERROR_STOP=1`; go to §9.
- Keep the operator shell session and the change-ticket timeline open until §8
  is complete.

---

## 8. Post-migration permission and application checks

### 8.1 Database enforcement (read-only)

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('users','company_career_pages','worker_status','app_meta','company_reviews')
order by relname;
-- expect: relrowsecurity = true, relforcerowsecurity = false for all five

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('users','company_career_pages','worker_status','app_meta','company_reviews');
-- expect: zero rows (no permissive policies)

select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('users','company_career_pages','worker_status','app_meta','company_reviews')
  and grantee in ('anon','authenticated')
group by table_name, grantee;
-- expect: zero rows
```

From the **application connection** (same identity as §5.5), confirm reads still
work and do not raise `permission denied for table`:

```sql
select (select count(*) from public.users)                  as users,
       (select count(*) from public.company_career_pages)   as career_pages,
       (select count(*) from public.worker_status)          as worker_status,
       (select count(*) from public.app_meta)               as app_meta,
       (select count(*) from public.company_reviews)        as reviews;
```

If the provider exposes PostgREST and the operator holds an `anon` key, an
authorized operator may additionally confirm that `GET /rest/v1/users` is denied
(401/403 or empty). Do not print the key or its value.

### 8.2 Application smoke checks

- [ ] `/api/health` returns healthy with no new errors.
- [ ] Login/register flow succeeds (writes and reads `users`).
- [ ] Authenticated profile GET works (reads `users`-derived data).
- [ ] Company reviews GET works (`company_reviews`).
- [ ] Cron tick runs and persists `app_meta` cursor (or verify via a controlled
      trigger — do not run an unscheduled production tick without approval).
- [ ] Worker heartbeat upsert still succeeds (`worker_status`), if worker is active.
- [ ] Application logs contain **no** `permission denied for table` or
      `row-level security policy` errors for these five tables.

Any failure → §9 immediately. Do not add policies or grants to make it pass.

---

## 9. Failure and recovery instructions

| Symptom | Root cause | Operator action |
| --- | --- | --- |
| `relation "company_reviews" does not exist` at `alter table` | Table created only by app bootstrap, not by migrations (§3). | Stop. Create it via the approved bootstrap/canonical DDL, then re-run 0005. 0005 is idempotent and earlier statements are already applied. |
| `role "anon" does not exist` | Target is not a standard Supabase role layout. | Stop. Confirm actual public role names with the provider. Do not guess or create roles in production without approval. |
| Partial application (some ALTERs/REVOKEs succeeded) | Statements are independent; `ON_ERROR_STOP` halted mid-file. | Fix the specific precondition and re-run 0005. Re-running is safe. |
| App returns `permission denied for table ...` / `new row violates row-level security policy` | Application is connecting with a non-owner, non-superuser, non-`BYPASSRLS` role. | **Roll back per §10**, keep the incident open, and re-architect the app connection to the owner/service role. Do not grant to `anon`/`authenticated` and do not add permissive policies. |
| PostgREST still exposes rows | Another role (e.g. `PUBLIC`) holds broad grants, or `service_role` key is being used publicly. | Keep 0005 applied; revoke the extra grants from the offending role and rotate any leaked key. Escalate as a security incident. |
| Backup/restore evidence missing or failing | Production backup job failing closed, or verification target invalid. | Stop before applying. Create and verify a fresh production backup. If already applied and evidence is missing, freeze further changes, produce evidence, and be ready to roll back. |
| Non-authorized process touched production | Credential/host mistake. | Stop, rotate the exposed credentials, preserve logs, and report per incident policy. |

Recovery principles:

- Prefer the **DDL rollback in §10** over a full database restore. A restore from
  an earlier dump would discard every write made after the backup.
- Keep 0005 applied if the failure is unrelated to these five tables — it is a
  security fix; narrowing the fix is better than removing it.
- After any rollback, the `users.password_hash` exposure is **restored**. Minimize
  the window and schedule the corrected migration immediately.

---

## 10. Safe rollback (authorized operator only)

Rollback is **not automatic**. It reverses a security hardening and must be
approved, executed and signed off by an authorized operator.

```sql
alter table public.users                disable row level security;
alter table public.company_career_pages disable row level security;
alter table public.worker_status        disable row level security;
alter table public.app_meta             disable row level security;
alter table public.company_reviews      disable row level security;
```

Then restore **only** the privileges captured in §5.4. Example (replace with the
exact captured grant list; if §5.4 recorded no `anon`/`authenticated` privileges,
skip the grant entirely):

```sql
-- grant <exact captured privilege list> on public.<table> to <exact captured grantee>;
```

Do **not**:

- enable `FORCE ROW LEVEL SECURITY` as a "fix";
- create policies that use `auth.uid()` (JobPilot uses custom auth; `auth.uid()`
  is NULL and would provide false isolation);
- grant broadly to `PUBLIC`;
- restore the whole database from backup unless data corruption is confirmed.

After rollback, re-run the §5.4 and §8.1 read-only checks and confirm the state
matches the captured preflight values.

---

## 11. Sign-off

| Step | Operator | UTC timestamp | Ticket link / evidence |
| --- | --- | --- | --- |
| Preflight §5 complete | | | |
| Verified production backup §6 attached | | | |
| 0005 applied §7 | | | |
| Post checks §8 pass | | | |
| Rollback not required / completed §10 | | | |

**Remember: passing tests and CI are necessary but not sufficient. Production
readiness is established only by an authorized operator completing this runbook
with verified backup evidence and explicit sign-off.**
