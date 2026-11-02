-- Row Level Security for JobPilot AI

alter table public.candidate_profiles enable row level security;
alter table public.candidate_skills enable row level security;
alter table public.candidate_preferences enable row level security;
alter table public.uploaded_resumes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.job_matches enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_events enable row level security;
alter table public.application_questions enable row level security;
alter table public.automation_tasks enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_logs enable row level security;
alter table public.scheduled_searches enable row level security;
alter table public.notifications enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.recruiter_contacts enable row level security;
alter table public.email_messages enable row level security;
alter table public.user_permissions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_integrations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.career_analyses enable row level security;
alter table public.company_targets enable row level security;
alter table public.sessions enable row level security;

-- Users can only access their own rows. Replace auth.uid() with your Supabase auth mapping.
create policy "own profile" on public.candidate_profiles for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own skills" on public.candidate_skills for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own preferences" on public.candidate_preferences for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own resumes" on public.uploaded_resumes for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own resume versions" on public.resume_versions for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own matches" on public.job_matches for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own saved jobs" on public.saved_jobs for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own applications" on public.applications for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own application documents" on public.application_documents for all using (exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()::text));
create policy "own application events" on public.application_events for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own application questions" on public.application_questions for all using (exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()::text));
create policy "own automation tasks" on public.automation_tasks for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own automation runs" on public.automation_runs for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own automation logs" on public.automation_logs for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own schedules" on public.scheduled_searches for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own interviews" on public.interview_sessions for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own recruiter contacts" on public.recruiter_contacts for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own emails" on public.email_messages for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own permissions" on public.user_permissions for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own notification prefs" on public.notification_preferences for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own email integration" on public.email_integrations for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own audit logs" on public.audit_logs for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own career analyses" on public.career_analyses for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own company targets" on public.company_targets for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "own sessions" on public.sessions for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Shared read-only reference data.
alter table public.jobs enable row level security;
alter table public.companies enable row level security;
alter table public.job_sources enable row level security;
create policy "jobs readable" on public.jobs for select using (true);
create policy "companies readable" on public.companies for select using (true);
create policy "job sources readable" on public.job_sources for select using (true);
