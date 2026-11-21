# Database Recovery — Progress (Batch 1)

## Issues addressed

- DB-001 (P0): Production fail-closed protection for database provider selection.
- DB-002 (P0): `push_subscriptions` migration added for PostgreSQL.
- DB-007 (P2): Idempotent bootstrap creation of `push_subscriptions`.
- DB-008 (P2): Removed destructive `DROP SCHEMA` from `setup-supabase.js`.
- DB-012 (P2): Storage fail-closed protection in production.

## Files changed

- `src/lib/db.ts` — added `resolveProvider()`; production requires `DATABASE_URL`/`POSTGRES_URL`, throws otherwise; SQLite remains default for dev/tests. All internal `provider ===` checks now call `resolveProvider()`.
- `src/lib/storage.ts` — added `resolveStorageProvider()`; production requires Supabase config, throws otherwise; local fallback preserved for dev/tests.
- `supabase/migrations/0003_push_subscriptions.sql` — new sequential migration creating `push_subscriptions` with user_id FK (cascade), unique(user_id, endpoint), index.
- `src/lib/bootstrap.ts` — removed duplicate `push_subscriptions` creation; the versioned migration is the authoritative source. Bootstrap retains other idempotent operations (company_reviews, company career pages, etc.).
- `scripts/setup-supabase.js` — removed `DROP SCHEMA`; now non-destructive (CREATE SCHEMA IF NOT EXISTS).
- `src/lib/db-config.test.ts` — new (5 tests).
- `src/lib/storage-config.test.ts` — new (4 tests).
- `src/lib/schema-consistency.test.ts` — new (4 tests).

## Migration filename

- `supabase/migrations/0003_push_subscriptions.sql` (NOT applied to production; run manually via migration tooling).

## Tests executed

- `npm run typecheck`: PASS (0 errors)
- `npm test`: PASS — 12 files, 69 tests (13 new)
- `npm run build`: PASS
- `node --check` not applicable (no .mjs changes this batch)

## Production configuration requirements

- `DATABASE_URL` or `POSTGRES_URL` must be set in production (already set in Vercel).
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY` must be set in production (already set).
- `0003_push_subscriptions.sql` must be applied to the production Postgres database via the migration tooling before push notifications can persist. It is NOT created automatically at application startup (bootstrap no longer duplicates it).

## Remaining blockers

- DB-003 (RLS mismatch) — not addressed this batch (requires architectural decision).
- DB-004 (in-process rate limiter) — deferred (Redis/Upstash not introduced per scope).
- DB-006 (toPgPlaceholders regex) — deferred.
- DB-010/DB-011 (CSRF origin bypass, spoofable IP) — deferred.

## Manual deployment requirements

- Apply `supabase/migrations/0003_push_subscriptions.sql` to production Postgres before deploying code that uses push subscriptions (the bootstrap also creates it idempotently on first app run, but versioned migration is preferred).
- No commit/push/deploy performed this batch (per instruction).

## Status

Implementation complete locally. Awaiting review. No production changes made.
