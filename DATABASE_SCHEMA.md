# Database Schema

The local schema is defined in `src/lib/schema.ts`. The production Postgres schema and RLS policies are in `supabase/migrations`.

Core tables:

- `users`, `sessions`
- `candidate_profiles`, `candidate_skills`, `candidate_preferences`
- `uploaded_resumes`, `resume_versions`
- `companies`, `company_career_pages`, `company_contacts`
- `job_sources`, `jobs`, `job_matches`, `saved_jobs`
- `applications`, `application_documents`, `application_events`, `application_questions`
- `automation_tasks`, `automation_runs`, `automation_logs`, `scheduled_searches`
- `notifications`, `interview_sessions`, `recruiter_contacts`, `email_messages`
- `user_permissions`, `notification_preferences`, `email_integrations`
- `audit_logs`, `career_analyses`, `company_targets`, `worker_status`, `app_meta`

Every user-owned table includes `user_id` and repository queries scope by it. Application actions write audit events. File paths are stored relative to the configured storage root and served only through authenticated routes.
