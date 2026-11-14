-- Keep candidate-imported job descriptions private to the account that added them.
-- Deleting that account removes its manual jobs through the foreign-key cascade.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS owner_user_id text
  REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jobs_owner_user
  ON public.jobs(owner_user_id);
