# JobPilot AI — Database & Authentication Audit

Audit-only. No code, schema, data, or configuration was modified. No migrations were run. No commits or deployments were made.

## 1. Executive summary

JobPilot AI uses a dual database provider: SQLite (`node:sqlite`) for local development and PostgreSQL (via `pg` + `DATABASE_URL`) in production. The local schema is defined in `src/lib/schema.ts` and applied automatically at connection time. Production relies on `supabase/migrations/0001_schema.sql` + `0002_rls.sql` applied out-of-band, plus idempotent runtime migrations in `src/lib/bootstrap.ts`. Authentication is custom (scrypt password hashing, opaque session tokens stored as SHA-256 hashes in the `sessions` table, HttpOnly cookies) — not Supabase Auth, despite RLS policies written against `auth.uid()`.

Key findings:
- **DB-001 (P0):** Production can silently fall back to SQLite if `DATABASE_URL`/`POSTGRES_URL` are absent, because provider selection is a simple env check with no fail-closed guard.
- **DB-002 (P0):** `push_subscriptions` table exists in the SQLite schema but is absent from the Supabase migration → push notifications broken in production.
- **DB-003 (P1):** RLS policies use `auth.uid()`, but the app uses custom sessions, so policies are inert/broken for the app's connection model and `auth.uid()` is null for all requests.
- **DB-004 (P1):** Rate limiter is in-process (`Map`), not shared across Vercel serverless instances.
- **DB-005 (P1):** Logout is GET-redirect without CSRF origin check; registration has `assertSameOrigin` but login does not.
- **DB-006 (P2):** `toPgPlaceholders` regex can corrupt SQL containing `?` in string literals.
- **DB-007 (P2):** Base schema is not auto-applied on Postgres; fresh DB requires manual migration.
- **DB-008 (P2):** `setup-supabase.js` drops the entire public schema (destructive).
- **DB-009 (P3):** Missing `middleware.ts`; auth enforced per-route (consistent but no central guard).
- **DB-010 (P2):** `APP_URL` fallback in logout redirect could be spoofed; `assertSameOrigin` allows missing origin.

Production health check (`/api/health`) reports `database: ok`, confirming the production app is connected to Postgres and authentication/session storage is reachable at runtime.

---

## 2. Actual database architecture

- **Local:** `src/lib/db.ts` selects `sqlite` when `DATABASE_URL`/`POSTGRES_URL` are unset. `node:sqlite` `DatabaseSync` opens `DATABASE_PATH` (default `./data/jobpilot.db`), enables foreign keys, WAL mode, busy timeout, and runs `SCHEMA_SQL` (full schema) at connection time.
- **Production:** provider = `postgres` when `DATABASE_URL` or `POSTGRES_URL` is set. `pg` `Pool` with `connectionString`, SSL default on (`rejectUnauthorized: false`), pool size 3, 10s connect timeout. Schema is NOT auto-applied; relies on `supabase/migrations/*.sql` applied out-of-band plus `bootstrapDatabase()` for incremental additions.
- **Storage:** Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise local filesystem (`STORAGE_DIR`, default `./storage`). Production has both → Supabase private bucket.
- **Runtime provider selection:** `process.env.DATABASE_URL || process.env.POSTGRES_URL ? "postgres" : "sqlite"` — no validation that the URL is reachable; if the var is set but connection fails, `getPug()` throws at query time (not a silent SQLite fallback, but no startup guard).

### Silent fallback risk (DB-001)
If `DATABASE_URL`/`POSTGRES_URL` are absent in production, the app silently uses SQLite on the serverless filesystem → data loss between invocations. Production currently has `DATABASE_URL` set, so this is latent but unguarded. No fail-closed check exists.

---

## 3. SQLite/PostgreSQL comparison

| Aspect | SQLite | PostgreSQL |
|---|---|---|
| Provider | `node:sqlite` | `pg` Pool |
| Schema init | `SCHEMA_SQL` at connect | Manual migration + bootstrap |
| Placeholders | `?` | converted to `$n` via regex |
| Booleans | INTEGER (0/1) | INTEGER (0/1) — consistent |
| JSON | TEXT | JSONB — `parseJson` handles both |
| Timestamps | ISO TEXT | timestamptz — ISO strings passed as params |
| Transactions | `BEGIN IMMEDIATE` | `BEGIN`/`COMMIT`/`ROLLBACK` |
| FK enforcement | `PRAGMA foreign_keys=ON` | native |
| Auto-increment | n/a (UUIDs) | n/a |

### Inconsistencies found
- **DB-002 (P0):** `push_subscriptions` table exists in `src/lib/schema.ts` but is absent from `supabase/migrations/0001_schema.sql`. Push notifications cannot persist in production.
- **DB-007 (P2):** Base schema not auto-applied on Postgres; fresh DB requires manual migration.
- `toPgPlaceholders` (DB-006) regex replaces every `?`, including inside string literals — latent corruption risk.
- `company_reviews` and login-tracking columns are added at runtime via `bootstrap.ts` (idempotent ALTER/CREATE) — consistent across providers.

---

## 4. Schema consistency report

All 34 core tables present in both SQLite schema and Supabase migration except `push_subscriptions` (SQLite only). Foreign keys reference `users(id)` with `ON DELETE CASCADE` for user-owned tables. Indexes exist for sessions, applications, jobs, matches, etc. `app_meta` exists only in Postgres migration (for cursor tracking); SQLite schema also defines it. Consistent.

---

## 5. Supabase configuration report

| Variable | Read by code | Location | Status (production) |
|---|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts` | server | present |
| `POSTGRES_URL` | `src/lib/db.ts` | server | (not in production env list; `DATABASE_URL` used) |
| `DATABASE_SSL` | `src/lib/db.ts` | server | present |
| `SUPABASE_URL` | `src/lib/storage.ts` | server | present |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/storage.ts` (fallback) | client/server | present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.example` only | — | present (per env list) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/storage.ts` | server | present |
| `SUPABASE_STORAGE_BUCKET` | `src/lib/storage.ts` | server | present |

- `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; code reads `SUPABASE_URL` (server) with `NEXT_PUBLIC_SUPABASE_URL` fallback. No mismatch in practice because both are set.
- Supabase service role is used only server-side in `storage.ts` (not exposed to client). Storage bucket is private (created with `public: false` in `setup-supabase.js`).
- `APP_ENCRYPTION_KEY` present in production.

### Configuration mismatch note
`SUPABASE_URL` vs `NEXT_PUBLIC_SUPABASE_URL`: code prefers `SUPABASE_URL`. Both are set in production, so no functional issue. Documented difference is cosmetic.

---

## 6. Environment variable mismatches

- `DATABASE_PATH` and `STORAGE_DIR` are set in production but ignored when `DATABASE_URL`/Supabase are configured. Harmless but confusing.
- `POSTGRES_URL` documented but not set in production (uses `DATABASE_URL`). Fine.
- No missing critical variables in production.

---

## 7. RLS policy review (DB-003)

`supabase/migrations/0002_rls.sql` enables RLS on 30+ tables and creates policies using `auth.uid()::text = user_id`. However, the application uses **custom authentication** (scrypt + opaque session tokens in the `sessions` table), not Supabase Auth. Therefore `auth.uid()` is null for every request made through the app's connection (which uses `DATABASE_URL` directly, bypassing Supabase's PostgREST/auth layer). Consequences:
- RLS policies are effectively inert for the app's data path.
- If any client used the anon key directly against PostgREST, all rows would be invisible (auth.uid() null → no rows).
- The app relies entirely on application-level `user_id` filtering in repository queries.
- RLS is defense-in-depth that does not match the auth model. Not a data leak today, but a false sense of security.

Recommendation (P2): either integrate Supabase Auth (large change, requires approval) or document that RLS is not the isolation boundary and rely on app-level filtering + service role only.

---

## 8. Authentication implementation review

- **Password hashing:** `src/lib/password.ts` uses `scrypt` (Node crypto) with a 16-byte random salt (`randomBytes(16)`), 64-byte derived key, stored as `scrypt$<saltHex>$<derivedHex>`. `verifyPassword` uses `timingSafeEqual`. Matches the documented "scrypt with per-user salts".
- **Password validation:** min 8 chars, requires letter + digit (`validatePasswordStrength`). Registration enforces min 8 via Zod; strength check available but registration route only checks length.
- **Session token:** `randomBytes(32)` (256 bits), stored as SHA-256 hash in `sessions.token_hash` (unique). Raw token only in cookie.
- **Session expiry:** `SESSION_TTL_DAYS` (default 30). Expired sessions deleted lazily on login and on `getSessionUser`.
- **Cookie:** `httpOnly: true`, `sameSite: "lax"`, `secure` in production, `path: "/"`, `expires`.
- **Login rate limit:** 10 attempts / 15 min per IP (in-process).
- **Registration rate limit:** 5 / 15 min per IP.
- **CSRF:** `assertSameOrigin` checks Origin vs Host (and APP_URL host). Applied to registration but NOT login (login is a credential submission with no state change; acceptable but inconsistent).
- **Account enumeration:** login returns generic "Invalid email or password." for both unknown email and wrong password. Registration returns "An account with this email already exists." (409) — reveals existence. Minor.
- **Middleware:** none. Auth enforced per-route via `requireUser`/`requireApiUser`. Consistent but no central guard; a new route could forget to call it.

### DB-005 (P1): Login lacks `assertSameOrigin`
Registration calls `assertSameOrigin(request)`; login does not. Login is a credential submission (no state mutation beyond session cookie), so CSRF risk is limited, but consistency is missing. Also `assertSameOrigin` returns early when `origin` header is absent, so requests with no Origin bypass the check entirely.

---

## 9. Session and cookie security

- HttpOnly: yes. Secure in production: yes. SameSite: lax (allows top-level navigations; acceptable).
- Session invalidation on logout: `destroySession` deletes the row and clears the cookie. ✅
- Session revocation: deleting the row invalidates. ✅
- No session fixation protection beyond new token per login. ✅ (new token generated each login)

---

## 10. User data isolation

- All user-owned tables carry `user_id`; repository queries scope by `user_id` (verified in `repositories.ts`).
- API routes use `requireApiUser()` and filter by `user.id`.
- Storage paths are namespaced under `users/<userId>/` (via `userDir`).
- File serving route (`/api/documents/[...path]`) checks auth and resolves path under storage root with traversal guard (`absoluteStoragePath` rejects paths outside root).
- **DB-011 (P2):** `clientIp` trusts `x-forwarded-for` without validation — can be spoofed to bypass per-IP rate limits. Minor.

### Potential IDOR review
Spot-checked `applications/[id]`, `jobs/[id]`, `interviews` routes — they filter by `user_id` in queries. No obvious IDOR found, but not exhaustively verified across all 58 routes.

---

## 11. File storage security

- Supabase storage: private bucket, server-side service role only. ✅
- Local fallback: filesystem under `STORAGE_DIR`. On Vercel this is ephemeral (DB-012, from prior audit).
- Download routes enforce auth via `requireApiUser`. ✅
- Path traversal guard in `absoluteStoragePath`. ✅

---

## 12. Existing test coverage

Tests (vitest): 9 files, 56 tests. Cover matching, normalization, permissions, worker-auth. **No database or authentication integration tests.** No tests for registration/login/session/logout/RLS/isolation. Coverage gap.

---

## 13. Production connectivity findings

- `/api/health` (read-only, production) returned: `status: ok`, `database: ok`, `ai: configured`, `worker: offline`. This confirms the production app is connected to PostgreSQL and the session/database layer is reachable.
- `worker: offline` is expected (GitHub Actions worker is scheduled, not persistent).
- No production credentials were exposed.

---

## 14. Confirmed bugs

| ID | Sev | File (line) | Summary |
|---|---|---|---|
| DB-001 | P0 | `src/lib/db.ts` (~7) | No fail-closed guard; absent `DATABASE_URL` silently selects SQLite in production. |
| DB-002 | P0 | `src/lib/schema.ts` (push_subscriptions); `supabase/migrations/0001_schema.sql` (missing) | `push_subscriptions` table missing in Postgres → push notifications broken in prod. |
| DB-003 | P1 | `supabase/migrations/0002_rls.sql` (all policies) | RLS uses `auth.uid()` but app uses custom auth → policies inert/mismatched. |
| DB-004 | P1 | `src/lib/rate-limit.ts` (1–20) | In-process rate limiter not shared across serverless instances. |
| DB-005 | P1 | `src/app/api/auth/login/route.ts` (14) | Login lacks `assertSameOrigin` check (inconsistent with registration). |
| DB-006 | P2 | `src/lib/db.ts` (~48) | `toPgPlaceholders` regex corrupts `?` in string literals. |
| DB-007 | P2 | `src/lib/db.ts` (202–208) | Base schema not auto-applied on Postgres. |
| DB-008 | P2 | `scripts/setup-supabase.js` (16) | Destructive schema drop. |
| DB-009 | P3 | (no middleware.ts) | No central auth guard; per-route enforcement only. |
| DB-010 | P2 | `src/lib/auth.ts` (135–149) | `assertSameOrigin` bypasses when Origin header absent. |
| DB-011 | P2 | `src/lib/rate-limit.ts` (28–33) | `clientIp` trusts spoofable `x-forwarded-for`. |
| DB-012 | P2 | `src/lib/storage.ts` (36–48) | Silent local-filesystem fallback on serverless (ephemeral). |

---

## 15. Potential security vulnerabilities

- Account enumeration via registration's "email already exists" response (P3).
- No password strength enforcement beyond length at registration (P3).
- Session cookie `SameSite=lax` (acceptable but not strict).
- No MFA (out of scope for MVP).
- RLS mismatch (DB-003) — false security boundary.

---

## 16. Missing configuration

- None critical in production (all DB/storage/AI/auth vars present).
- `POSTGRES_URL` not set in production (uses `DATABASE_URL`) — fine.
- No Supabase Auth configured (by design; custom auth used).

---

## 17. Exact recovery sequence

1. **DB-001** (P0): Add fail-closed guard — if `NODE_ENV=production` and no `DATABASE_URL`/`POSTGRES_URL`, throw on startup instead of selecting SQLite.
2. **DB-002** (P0): Add `push_subscriptions` table to `supabase/migrations/0001_schema.sql` (and ensure bootstrap creates it idempotently).
3. **DB-007** (P2): Make `ensureSchema` apply base schema on Postgres (or run migrations on startup with version tracking).
4. **DB-008** (P2): Remove destructive `DROP SCHEMA` from `setup-supabase.js`.
5. **DB-006** (P2): Make `toPgPlaceholders` placeholder-aware.
6. **DB-005 / DB-010** (P1/P2): Add `assertSameOrigin` to login; reject missing Origin.
7. **DB-003** (P1): Document or fix RLS mismatch (requires architectural decision).
8. **DB-004** (P1): Replace in-process rate limiter with Redis/Upstash in production (or accept per-instance limits).
9. **DB-012** (P2): Fail fast when storage unconfigured in production.
10. Add database + auth integration tests.

---

## Top five issues requiring attention (before early access)

1. **DB-001 (P0)** — Silent SQLite fallback in production risks total data loss.
2. **DB-002 (P0)** — `push_subscriptions` missing in Postgres breaks push notifications in production.
3. **DB-003 (P1)** — RLS policies don't match the custom auth model (false security boundary).
4. **DB-004 (P1)** — In-process rate limiter ineffective on serverless.
5. **DB-005 (P1)** — Login lacks CSRF origin check.

---

**Audit complete. No code, schema, data, or configuration was modified. No commits or deployments were made. Awaiting review before implementing fixes.**
