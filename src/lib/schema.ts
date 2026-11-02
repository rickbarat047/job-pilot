/**
 * Local-first schema. Mirrors supabase/migrations/0001_schema.sql.
 * Every user-owned table carries user_id and all repository queries scope by it.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'India',
  linkedin_url TEXT NOT NULL DEFAULT '',
  github_url TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  degree TEXT NOT NULL DEFAULT '',
  university TEXT NOT NULL DEFAULT '',
  graduation_year TEXT NOT NULL DEFAULT '',
  cgpa TEXT NOT NULL DEFAULT '',
  experience_years REAL NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'Fresher',
  notice_period TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '[]',
  raw_cv_text TEXT NOT NULL DEFAULT '',
  profile_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidate_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  proficiency TEXT,
  years REAL,
  source TEXT,
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_skills_user ON candidate_skills(user_id);

CREATE TABLE IF NOT EXISTS candidate_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_roles TEXT NOT NULL DEFAULT '[]',
  experience_levels TEXT NOT NULL DEFAULT '[]',
  employment_types TEXT NOT NULL DEFAULT '[]',
  work_modes TEXT NOT NULL DEFAULT '[]',
  preferred_locations TEXT NOT NULL DEFAULT '[]',
  all_india INTEGER NOT NULL DEFAULT 1,
  remote_india INTEGER NOT NULL DEFAULT 1,
  international_remote INTEGER NOT NULL DEFAULT 0,
  min_salary_lpa REAL,
  salary_flexible INTEGER NOT NULL DEFAULT 1,
  unpaid_internship INTEGER NOT NULL DEFAULT 0,
  paid_internship INTEGER NOT NULL DEFAULT 1,
  industries TEXT NOT NULL DEFAULT '[]',
  flexibility TEXT NOT NULL DEFAULT '{}',
  match_weights TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploaded_resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  parsed_text TEXT NOT NULL DEFAULT '',
  parse_status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON uploaded_resumes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS resume_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id TEXT REFERENCES uploaded_resumes(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  content_json TEXT NOT NULL,
  file_pdf_path TEXT,
  file_docx_path TEXT,
  ats_keywords TEXT NOT NULL DEFAULT '[]',
  customization_notes TEXT NOT NULL DEFAULT '[]',
  provider TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resume_versions_user ON resume_versions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT,
  careers_url TEXT,
  industry TEXT,
  location TEXT,
  size TEXT,
  stage TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'curated',
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_career_pages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  ats_type TEXT,
  ats_identifier TEXT,
  verified_at TEXT,
  last_checked_at TEXT,
  status TEXT NOT NULL DEFAULT 'unchecked',
  UNIQUE(company_id, url)
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  email TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TEXT NOT NULL,
  UNIQUE(company_id, email)
);

CREATE TABLE IF NOT EXISTS job_sources (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle',
  last_run_at TEXT,
  last_error TEXT,
  reliability REAL NOT NULL DEFAULT 0.8,
  config TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  company_website TEXT,
  career_page_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_html TEXT,
  location TEXT NOT NULL DEFAULT '',
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Unknown',
  remote_status TEXT NOT NULL DEFAULT 'unknown',
  employment_type TEXT NOT NULL DEFAULT 'unknown',
  experience_required TEXT,
  education_requirements TEXT,
  skills_required TEXT NOT NULL DEFAULT '[]',
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_text TEXT,
  application_url TEXT NOT NULL,
  application_method TEXT NOT NULL DEFAULT 'external',
  source TEXT NOT NULL,
  source_job_id TEXT NOT NULL,
  posted_at TEXT,
  last_verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reliability REAL NOT NULL DEFAULT 0.8,
  fingerprint TEXT NOT NULL UNIQUE,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_name);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(country);

CREATE TABLE IF NOT EXISTS job_matches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  overall_score REAL NOT NULL,
  skill_score REAL NOT NULL,
  education_score REAL NOT NULL,
  experience_score REAL NOT NULL,
  career_score REAL NOT NULL,
  location_score REAL NOT NULL,
  salary_score REAL NOT NULL,
  flexibility_score REAL NOT NULL,
  freshness_score REAL NOT NULL,
  strengths TEXT NOT NULL DEFAULT '[]',
  gaps TEXT NOT NULL DEFAULT '[]',
  missing_requirements TEXT NOT NULL DEFAULT '[]',
  disqualifiers TEXT NOT NULL DEFAULT '[]',
  explanation TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  qualified INTEGER NOT NULL DEFAULT 1,
  role_family TEXT,
  ai_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_user_score ON job_matches(user_id, overall_score DESC);

CREATE TABLE IF NOT EXISTS saved_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'saved',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_jobs(user_id, state);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'Draft Ready',
  autonomy_level INTEGER NOT NULL DEFAULT 3,
  application_method TEXT NOT NULL DEFAULT 'external',
  match_score REAL,
  resume_version_id TEXT REFERENCES resume_versions(id) ON DELETE SET NULL,
  cover_letter_id TEXT REFERENCES resume_versions(id) ON DELETE SET NULL,
  recruiter_email_id TEXT REFERENCES email_messages(id) ON DELETE SET NULL,
  approval_required INTEGER NOT NULL DEFAULT 1,
  approved_at TEXT,
  applied_at TEXT,
  last_event_at TEXT NOT NULL,
  notes TEXT,
  duplicate_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, duplicate_key)
);
CREATE INDEX IF NOT EXISTS idx_applications_user_state ON applications(user_id, state);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);

CREATE TABLE IF NOT EXISTS application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  resume_version_id TEXT REFERENCES resume_versions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_application ON application_documents(application_id);

CREATE TABLE IF NOT EXISTS application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_application ON application_events(application_id, created_at);

CREATE TABLE IF NOT EXISTS application_questions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  requires_approval INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5,
  payload TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_run_at TEXT NOT NULL,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON automation_tasks(status, next_run_at);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES automation_tasks(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_user ON automation_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES automation_runs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_user ON automation_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  hour_local INTEGER NOT NULL DEFAULT 8,
  sources TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON scheduled_searches(enabled, next_run_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  action_url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'prep',
  status TEXT NOT NULL DEFAULT 'active',
  questions TEXT NOT NULL DEFAULT '[]',
  answers TEXT NOT NULL DEFAULT '[]',
  feedback TEXT,
  score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interviews_user ON interview_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recruiter_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT,
  role TEXT,
  email TEXT,
  linkedin_url TEXT,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  provider_id TEXT,
  sent_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_emails_user ON email_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  autonomy_level INTEGER NOT NULL DEFAULT 3,
  search_jobs TEXT NOT NULL DEFAULT 'automatic',
  analyze_jobs TEXT NOT NULL DEFAULT 'automatic',
  match_jobs TEXT NOT NULL DEFAULT 'automatic',
  generate_resumes TEXT NOT NULL DEFAULT 'automatic',
  generate_cover_letters TEXT NOT NULL DEFAULT 'automatic',
  save_drafts TEXT NOT NULL DEFAULT 'automatic',
  submit_applications TEXT NOT NULL DEFAULT 'approval',
  send_recruiter_emails TEXT NOT NULL DEFAULT 'approval',
  answer_sensitive_questions TEXT NOT NULL DEFAULT 'approval',
  accept_offers TEXT NOT NULL DEFAULT 'never',
  share_personal_info TEXT NOT NULL DEFAULT 'approval',
  auto_apply_categories TEXT NOT NULL DEFAULT '[]',
  auto_apply_min_score REAL NOT NULL DEFAULT 85,
  allow_duplicate_applications INTEGER NOT NULL DEFAULT 0,
  demo_mode INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  daily_digest INTEGER NOT NULL DEFAULT 1,
  application_updates INTEGER NOT NULL DEFAULT 1,
  interview_reminders INTEGER NOT NULL DEFAULT 1,
  frequency TEXT NOT NULL DEFAULT 'daily',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_integrations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'smtp',
  from_email TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_secure INTEGER NOT NULL DEFAULT 0,
  smtp_user TEXT,
  smtp_password_enc TEXT,
  status TEXT NOT NULL DEFAULT 'not_configured',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS career_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paths TEXT NOT NULL DEFAULT '[]',
  transferable_skills TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_career_user ON career_analyses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS company_targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'watching',
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS worker_status (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  last_heartbeat TEXT,
  meta TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const LOCAL_SCHEMA_VERSION = 1;
