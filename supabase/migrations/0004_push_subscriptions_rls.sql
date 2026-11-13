-- Migration 0004: push_subscriptions Row Level Security
--
-- Protects push_subscriptions against direct unauthorized Supabase PostgREST
-- access while preserving JobPilot's custom authentication and direct
-- PostgreSQL connection.
--
-- Design:
--   * RLS is enabled (default-deny for anon/authenticated).
--   * No policies use auth.uid() (JobPilot does not use Supabase Auth).
--   * FORCE ROW LEVEL SECURITY is NOT enabled, so the table owner and
--     privileged roles (including the trusted server-side application
--     connection) continue to bypass RLS and operate normally.
--   * anon and authenticated direct table privileges are revoked as an
--     additional defense-in-depth layer.
--   * No table recreation, no data modification, no destructive SQL.

-- Enable RLS (default deny for anon/authenticated).
alter table public.push_subscriptions enable row level security;

-- Defense in depth: remove direct table access from public-facing roles.
-- The trusted server-side application connection (table owner / service
-- role) is unaffected and continues to operate via the direct Postgres
-- connection (DATABASE_URL).
revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;

-- No permissive policies are created. With RLS enabled and no policy
-- granting access, anon/authenticated requests are denied by default.
-- Do NOT add auth.uid()-based policies: auth.uid() is NULL under the
-- custom authentication model and would not provide correct isolation.
