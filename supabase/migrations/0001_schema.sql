-- JobPilot AI production schema (PostgreSQL / Supabase)
-- Run with: supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id text primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sessions (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default 'India',
  linkedin_url text not null default '',
  github_url text not null default '',
  portfolio_url text not null default '',
  headline text not null default '',
  summary text not null default '',
  degree text not null default '',
  university text not null default '',
  graduation_year text not null default '',
  cgpa text not null default '',
  experience_years numeric not null default 0,
  current_status text not null default 'Fresher',
  notice_period text not null default '',
  languages jsonb not null default '[]'::jsonb,
  raw_cv_text text not null default '',
  profile_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_skills (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  category text,
  proficiency text,
  years numeric,
  source text,
  unique (user_id, name)
);

create table if not exists public.candidate_preferences (
  user_id text primary key references public.users(id) on delete cascade,
  target_roles jsonb not null default '[]'::jsonb,
  experience_levels jsonb not null default '[]'::jsonb,
  employment_types jsonb not null default '[]'::jsonb,
  work_modes jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  all_india integer not null default 1,
  remote_india integer not null default 1,
  international_remote integer not null default 0,
  min_salary_lpa numeric,
  salary_flexible integer not null default 1,
  unpaid_internship integer not null default 0,
  paid_internship integer not null default 1,
  industries jsonb not null default '[]'::jsonb,
  flexibility jsonb not null default '{}'::jsonb,
  match_weights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_resumes (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size bigint not null,
  storage_path text not null,
  parsed_text text not null default '',
  parse_status text not null default 'pending',
  parse_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  resume_id text references public.uploaded_resumes(id) on delete set null,
  job_id text,
  title text not null,
  kind text not null,
  content_json jsonb not null,
  file_pdf_path text,
  file_docx_path text,
  ats_keywords jsonb not null default '[]'::jsonb,
  customization_notes jsonb not null default '[]'::jsonb,
  provider text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id text primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website text,
  careers_url text,
  industry text,
  location text,
  size text,
  stage text,
  description text,
  source text not null default 'curated',
  verified integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_career_pages (
  id text primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  url text not null,
  ats_type text,
  ats_identifier text,
  verified_at timestamptz,
  last_checked_at timestamptz,
  status text not null default 'unchecked',
  unique (company_id, url)
);

create table if not exists public.company_contacts (
  id text primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  name text,
  role text,
  email text,
  source_url text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create table if not exists public.job_sources (
  id text primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  category text not null,
  enabled integer not null default 1,
  status text not null default 'idle',
  last_run_at timestamptz,
  last_error text,
  reliability numeric not null default 0.8,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id text primary key,
  title text not null,
  company_id text references public.companies(id) on delete set null,
  company_name text not null,
  company_website text,
  career_page_url text,
  description text not null default '',
  description_html text,
  location text not null default '',
  city text,
  country text not null default 'Unknown',
  remote_status text not null default 'unknown',
  employment_type text not null default 'unknown',
  experience_required text,
  education_requirements text,
  skills_required jsonb not null default '[]'::jsonb,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_text text,
  application_url text not null,
  application_method text not null default 'external',
  source text not null,
  source_job_id text not null,
  posted_at timestamptz,
  last_verified_at timestamptz not null default now(),
  status text not null default 'active',
  reliability numeric not null default 0.8,
  fingerprint text not null unique,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_matches (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  overall_score numeric not null,
  skill_score numeric not null,
  education_score numeric not null,
  experience_score numeric not null,
  career_score numeric not null,
  location_score numeric not null,
  salary_score numeric not null,
  flexibility_score numeric not null,
  freshness_score numeric not null,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  missing_requirements jsonb not null default '[]'::jsonb,
  disqualifiers jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  recommended_action text not null default '',
  qualified integer not null default 1,
  role_family text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.saved_jobs (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  state text not null default 'saved',
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.applications (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  job_id text not null references public.jobs(id) on delete cascade,
  company_id text references public.companies(id) on delete set null,
  state text not null default 'Draft Ready',
  autonomy_level integer not null default 3,
  application_method text not null default 'external',
  match_score numeric,
  resume_version_id text references public.resume_versions(id) on delete set null,
  cover_letter_id text references public.resume_versions(id) on delete set null,
  recruiter_email_id text,
  approval_required integer not null default 1,
  approved_at timestamptz,
  applied_at timestamptz,
  last_event_at timestamptz not null default now(),
  notes text,
  duplicate_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, duplicate_key)
);

create table if not exists public.application_documents (
  id text primary key default gen_random_uuid(),
  application_id text not null references public.applications(id) on delete cascade,
  resume_version_id text references public.resume_versions(id) on delete set null,
  kind text not null,
  filename text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.application_events (
  id text primary key default gen_random_uuid(),
  application_id text not null references public.applications(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  event_type text not null,
  from_state text,
  to_state text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.application_questions (
  id text primary key default gen_random_uuid(),
  application_id text not null references public.applications(id) on delete cascade,
  question text not null,
  answer text not null default '',
  requires_approval integer not null default 0,
  sensitive integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.automation_tasks (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  priority integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  task_id text references public.automation_tasks(id) on delete set null,
  trigger text not null,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table if not exists public.automation_logs (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  run_id text references public.automation_runs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_searches (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  frequency text not null default 'daily',
  hour_local integer not null default 8,
  sources jsonb not null default '[]'::jsonb,
  enabled integer not null default 1,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  action_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  application_id text references public.applications(id) on delete cascade,
  type text not null default 'prep',
  status text not null default 'active',
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  feedback text,
  score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_contacts (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  company_id text references public.companies(id) on delete set null,
  name text,
  role text,
  email text,
  linkedin_url text,
  source_url text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table if not exists public.email_messages (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  application_id text references public.applications(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  provider_id text,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_permissions (
  user_id text primary key references public.users(id) on delete cascade,
  autonomy_level integer not null default 3,
  search_jobs text not null default 'automatic',
  analyze_jobs text not null default 'automatic',
  match_jobs text not null default 'automatic',
  generate_resumes text not null default 'automatic',
  generate_cover_letters text not null default 'automatic',
  save_drafts text not null default 'automatic',
  submit_applications text not null default 'approval',
  send_recruiter_emails text not null default 'approval',
  answer_sensitive_questions text not null default 'approval',
  accept_offers text not null default 'never',
  share_personal_info text not null default 'approval',
  auto_apply_categories jsonb not null default '[]'::jsonb,
  auto_apply_min_score numeric not null default 85,
  allow_duplicate_applications integer not null default 0,
  demo_mode integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id text primary key references public.users(id) on delete cascade,
  email_enabled integer not null default 0,
  daily_digest integer not null default 1,
  application_updates integer not null default 1,
  interview_reminders integer not null default 1,
  frequency text not null default 'daily',
  updated_at timestamptz not null default now()
);

create table if not exists public.email_integrations (
  user_id text primary key references public.users(id) on delete cascade,
  provider text not null default 'smtp',
  from_email text,
  smtp_host text,
  smtp_port integer,
  smtp_secure integer not null default 0,
  smtp_user text,
  smtp_password_enc text,
  status text not null default 'not_configured',
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.career_analyses (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  paths jsonb not null default '[]'::jsonb,
  transferable_skills jsonb not null default '[]'::jsonb,
  summary text not null default '',
  provider text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create table if not exists public.company_targets (
  id text primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  status text not null default 'watching',
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create table if not exists public.worker_status (
  id text primary key,
  name text not null,
  status text not null default 'offline',
  last_heartbeat timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.app_meta (
  key text primary key,
  value text not null
);


