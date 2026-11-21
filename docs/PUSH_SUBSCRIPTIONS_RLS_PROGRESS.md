# Push Subscriptions RLS — Progress

## Security issue

Direct PostgREST access to `push_subscriptions` was unprotected: RLS was disabled and no policies existed, so the `anon`/`authenticated` roles could read/write all subscription records (including `p256dh` and `auth` keys) if they used the client-exposed anon key. Application-level isolation via `requireApiUser()` + `user_id` filtering remains the primary boundary.

## Database role verification

- The application connects via `pg` using `DATABASE_URL` (direct Postgres connection), not Supabase PostgREST. The connected role is whatever `DATABASE_URL` specifies.
- Role ownership, `BYPASSRLS`, and `FORCE RLS` settings **cannot be verified** from this environment (no production DB access; credentials are hidden).
- Production runtime compatibility of enabling RLS is therefore **UNVERIFIED**. The migration deliberately does NOT enable `FORCE ROW LEVEL SECURITY`, so table owners and privileged roles (including the trusted server-side connection, if it owns the table or has BYPASSRLS) continue to bypass RLS. If the application role is neither the owner nor privileged, enabling RLS could block app operations — this must be verified against production before applying.

## RLS implementation

New migration: `supabase/migrations/0004_push_subscriptions_rls.sql`

- `alter table public.push_subscriptions enable row level security;`
- `revoke all on public.push_subscriptions from anon;`
- `revoke all on public.push_subscriptions from authenticated;`
- No permissive policies (default deny).
- No `auth.uid()` usage.
- No `FORCE ROW LEVEL SECURITY`.
- No table drop/recreate; no data modification.

## Grants and privileges

- `anon` and `authenticated` lose all direct table privileges (defense in depth).
- Trusted server-side application connection (table owner / service role) is unaffected and continues to operate.

## Tests

- `src/lib/push-subscriptions-rls.test.ts` (new): 6 static SQL checks + 1 application-level isolation check + 3 skipped runtime permission tests (UNVERIFIED, requires PostgreSQL).
- Runtime permission tests (anon/authenticated denial, app role functionality) are marked `it.skip` and UNVERIFIED — no PostgreSQL instance available.

## Unverified production checks

- Whether the application DB role owns `push_subscriptions` or has BYPASSRLS.
- Whether enabling RLS affects application CRUD.
- Whether `anon`/`authenticated` had table privileges before the revoke (assumed yes via Supabase defaults).

## Migration order

1. `0003_push_subscriptions.sql` (table + index)
2. `0004_push_subscriptions_rls.sql` (RLS + revoke)

Both pending. Verify with `supabase migration list --remote` and `supabase db push --remote --dry-run` before applying.

## Deployment requirements

- Apply `0003` then `0004` via `supabase db push --remote` (CLI, not SQL Editor, to keep migration history consistent).
- Verify role compatibility in a staging/production-like environment before applying to production.
- No commit, push, or deploy performed.

## Status

Implementation complete locally. Awaiting review. No production changes made.
