-- Migration 0005: close RLS gaps on privileged/system tables.
--
-- These tables contain password hashes, worker heartbeats, cron cursors and
-- review data. They must never be readable or writable through PostgREST by
-- anon/authenticated clients. The application's service-role connection
-- bypasses RLS, so server-side behaviour is unchanged.

alter table public.users enable row level security;
alter table public.company_career_pages enable row level security;
alter table public.worker_status enable row level security;
alter table public.app_meta enable row level security;
alter table public.company_reviews enable row level security;

-- No policies are created: RLS is default-deny for anon and authenticated.
revoke all on public.users from anon, authenticated;
revoke all on public.company_career_pages from anon, authenticated;
revoke all on public.worker_status from anon, authenticated;
revoke all on public.app_meta from anon, authenticated;
revoke all on public.company_reviews from anon, authenticated;
