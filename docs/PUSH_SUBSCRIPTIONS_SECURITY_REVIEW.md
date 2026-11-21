# Push Subscriptions — Security Review

Audit-only. No SQL, policies, code, or configuration were changed. No migrations executed.

## 1. RLS status on push_subscriptions

- **RLS is NOT enabled** on `push_subscriptions`. The migration `0003_push_subscriptions.sql` contains only `CREATE TABLE`/`CREATE INDEX`; it does not include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- `0002_rls.sql` enables RLS and creates policies for ~30 tables, but `push_subscriptions` is absent from that migration (it did not exist when 0002 was written). Therefore no policy covers it.

## 2. Anon / authenticated Supabase role access

- Because RLS is disabled, the table is fully readable and writable by **any role** that has table privileges, including the `anon` and `authenticated` roles, if reached via PostgREST.
- The `anon` key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is a client-exposed value. If a client used it against PostgREST, it could read/write all push subscriptions.

## 3. Application database role

- The application connects via `pg` using `DATABASE_URL` (direct Postgres connection), not via the Supabase client/PostgREST. The connected role is whatever `DATABASE_URL` points to (typically the Postgres owner or a service role). This role bypasses RLS entirely.
- The Supabase JS client is used **only** in `src/lib/storage.ts` for the Storage API, with `SUPABASE_SERVICE_ROLE_KEY`. It is not used for database queries.
- Conclusion: RLS is not on the application's data path today.

## 4. Interaction with custom authentication

- Authentication is custom (scrypt + opaque session tokens in `sessions` table). Supabase Auth is **not** used.
- `auth.uid()` is therefore `NULL` for every request. Any policy written as `auth.uid()::text = user_id` would evaluate to false for all rows, blocking all access via PostgREST — including for the app if it ever used PostgREST.
- The app's isolation boundary is application-level `user_id` filtering in repository queries (`src/lib/repositories.ts`, `src/lib/auth.ts`), not RLS.

## 5. Protection of push endpoints and keys

- API routes (`src/app/api/push/subscribe/route.ts`) require `requireApiUser()` (session cookie → `sessions` table → user). ✅
- All queries filter by `user.id` (SELECT/UPDATE/DELETE all include `WHERE user_id = ?`). ✅
- `p256dh` and `auth` (the Web Push encryption keys) are stored server-side and never returned in API responses (the subscribe endpoint returns only `{ ok: true }`). ✅
- The VAPID public key endpoint (`/api/push/vapid-public-key`) is authenticated (`requireApiUser`) and returns only the public key. ✅
- No direct client read of `push_subscriptions` exists.

## 6. Direct PostgREST exposure risk

- **Risk:** If the `anon` key is used directly against PostgREST, `push_subscriptions` is fully exposed (read/write) because RLS is disabled. This includes endpoints and encryption keys — sensitive subscription data.
- **Likelihood:** Low today, because the app does not use PostgREST for DB access. But the `anon` key is client-exposed, and a leaked/misused key would expose the table.
- **Mitigation needed:** Enable RLS on `push_subscriptions` with default-deny for `anon`/`authenticated`, so direct PostgREST access returns no rows. The app's direct Postgres connection (owner/service role) bypasses RLS and continues to work unchanged.

## 7. Recommended safest implementation (compatible with custom auth)

Do NOT use `auth.uid()` (it is null under custom auth). Instead, enable RLS with default-deny:

```sql
-- In a new migration, e.g. 0004_push_subscriptions_rls.sql
alter table public.push_subscriptions enable row level security;

-- Default deny: no policies for anon/authenticated.
-- (Absence of a permissive policy = deny by default under RLS.)

-- Optional: explicit deny policy for clarity (not required)
-- create policy "push_subscriptions no direct access"
--   on public.push_subscriptions for all
--   to anon, authenticated
--   using (false) with check (false);
```

Rationale:
- The app uses a direct Postgres connection (owner/service role), which bypasses RLS → app functionality unaffected.
- Direct PostgREST access with `anon`/`authenticated` returns nothing → subscription data protected.
- No dependency on Supabase Auth → compatible with the custom auth model.
- No `auth.uid()` policy → no false claim of working isolation.

**Important caveat:** This protects against PostgREST exposure but does not provide per-user isolation at the DB layer. Per-user isolation remains an application-level responsibility (and is enforced in the API routes). If per-user RLS is ever desired, the app must either adopt Supabase Auth or map the custom session to a Postgres role/setting — both are architectural changes requiring explicit approval.

Also consider: `0002_rls.sql` should be updated to include `push_subscriptions` for consistency (in a new migration, not by editing 0002). And `company_reviews` (bootstrap-only) should be reconciled into a migration for consistency.

## 8. Preflight update

Add to `docs/DB_BATCH1_DEPLOYMENT_PREFLIGHT.md` before migration execution:

```bash
# Dry run: show which migrations would be applied, without applying them
supabase db push --remote --dry-run
```

Use the dry-run output to confirm exactly `0003_push_subscriptions` (and any other pending) would be applied, and that no unexpected migration is included. Only proceed if the dry-run lists the expected set.

## 9. Summary

- RLS on `push_subscriptions`: **not enabled** → direct PostgREST exposure risk (low likelihood, high impact).
- App-level isolation: **enforced** via `requireApiUser()` + `user_id` scoping.
- Encryption keys (`p256dh`, `auth`): stored server-side, never returned.
- Recommended: enable RLS with default-deny (no `auth.uid()` policies) in a new migration.
- No production SQL, policy, or config changes were made during this review.

**Awaiting review before implementing the RLS migration.**
