-- Migration 0003: push_subscriptions
-- Adds the push_subscriptions table for web push notification subscriptions.
-- Idempotent: safe to run multiple times.

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
