import { NextResponse } from "next/server";
import { requireApiUser, destroySession, assertSameOrigin } from "@/lib/auth";
import { affectedRows, all, get, nowIso, transaction } from "@/lib/db";
import { getProfile, getPreferences } from "@/lib/repositories";
import { deleteUserFiles } from "@/lib/storage";

export async function GET() {
  try {
    const user = await requireApiUser();
    const [profile, preferences, permissions, applications, matches, savedJobs, events, questions, documents, resumes, resumeVersions,
      emails, notifications, interviews, recruiterContacts, tasks, runs, logs, schedules, careerAnalyses, companyTargets,
      companyReviews, auditLogs, emailIntegration, notificationPreferences] = await Promise.all([
      getProfile(user.id),
      getPreferences(user.id),
      get<{ autonomy_level: number; search_jobs: string; analyze_jobs: string; match_jobs: string; generate_resumes: string; generate_cover_letters: string; save_drafts: string; submit_applications: string; send_recruiter_emails: string; answer_sensitive_questions: string; accept_offers: string; share_personal_info: string; auto_apply_categories: string; auto_apply_min_score: number; allow_duplicate_applications: number; demo_mode: number }>("SELECT autonomy_level, search_jobs, analyze_jobs, match_jobs, generate_resumes, generate_cover_letters, save_drafts, submit_applications, send_recruiter_emails, answer_sensitive_questions, accept_offers, share_personal_info, auto_apply_categories, auto_apply_min_score, allow_duplicate_applications, demo_mode FROM user_permissions WHERE user_id = ?", [user.id]),
      all("SELECT a.*, j.title AS job_title, j.company_name AS company_name, j.location AS job_location, j.application_url AS application_url FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.created_at DESC", [user.id]),
      all("SELECT m.*, j.title AS job_title, j.company_name AS company_name, j.location AS job_location, j.application_url AS application_url FROM job_matches m JOIN jobs j ON j.id=m.job_id WHERE m.user_id=? ORDER BY m.updated_at DESC", [user.id]),
      all("SELECT s.id, s.job_id, s.state, s.created_at, j.title AS job_title, j.company_name AS company_name, j.location AS job_location, j.application_url AS application_url FROM saved_jobs s JOIN jobs j ON j.id=s.job_id WHERE s.user_id=? ORDER BY s.created_at DESC", [user.id]),
      all("SELECT * FROM application_events WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT q.* FROM application_questions q JOIN applications a ON a.id=q.application_id WHERE a.user_id=? ORDER BY q.created_at", [user.id]),
      all<{ id: string; application_id: string; kind: string; filename: string; path: string; created_at: string }>("SELECT d.id, d.application_id, d.kind, d.filename, d.path, d.created_at FROM application_documents d JOIN applications a ON a.id=d.application_id WHERE a.user_id=? ORDER BY d.created_at", [user.id]),
      all<{ id: string; filename: string; mime_type: string; size: number; parsed_text: string; parse_status: string; parse_error: string | null; created_at: string; storage_path: string }>("SELECT id, filename, mime_type, size, parsed_text, parse_status, parse_error, created_at, storage_path FROM uploaded_resumes WHERE user_id=? ORDER BY created_at", [user.id]),
      all<{ id: string; resume_id: string | null; job_id: string | null; title: string; kind: string; content_json: string; file_pdf_path: string | null; file_docx_path: string | null; ats_keywords: string; customization_notes: string; provider: string; created_at: string }>("SELECT id, resume_id, job_id, title, kind, content_json, file_pdf_path, file_docx_path, ats_keywords, customization_notes, provider, created_at FROM resume_versions WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT id, application_id, to_email, subject, body, status, sent_at, created_at FROM email_messages WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM interview_sessions WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM recruiter_contacts WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT id, type, status, priority, payload, attempts, max_attempts, next_run_at, locked_at, last_error, created_at, updated_at FROM automation_tasks WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM automation_runs WHERE user_id=? ORDER BY started_at", [user.id]),
      all("SELECT * FROM automation_logs WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM scheduled_searches WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM career_analyses WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM company_targets WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM company_reviews WHERE user_id=? ORDER BY created_at", [user.id]),
      all("SELECT * FROM audit_logs WHERE user_id=? ORDER BY created_at", [user.id]),
      get("SELECT provider, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, status, updated_at FROM email_integrations WHERE user_id=?", [user.id]),
      get("SELECT email_enabled, daily_digest, application_updates, interview_reminders, frequency, updated_at FROM notification_preferences WHERE user_id=?", [user.id]),
    ]);
    const fileUrl = (storagePath: string | null) => {
      if (!storagePath?.startsWith(`users/${user.id}/`)) return null;
      return `/api/documents/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
    };
    const files = [
      ...resumes.map(({ storage_path, ...resume }) => ({ ...resume, download_url: fileUrl(storage_path) })),
      ...documents.map(({ path, ...document }) => ({ ...document, download_url: fileUrl(path) })),
      ...resumeVersions.map(({ file_pdf_path, file_docx_path, ...version }) => ({
        ...version,
        pdf_download_url: fileUrl(file_pdf_path),
        docx_download_url: fileUrl(file_docx_path),
      })),
    ];
    const payload = {
      exportedAt: nowIso(),
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      profile,
      preferences,
      permissions,
      notificationPreferences,
      emailIntegration,
      applications,
      matches,
      savedJobs,
      applicationEvents: events,
      applicationQuestions: questions,
      files,
      emailMessages: emails,
      notifications,
      interviews,
      recruiterContacts,
      automationTasks: tasks,
      automationRuns: runs,
      automationLogs: logs,
      scheduledSearches: schedules,
      careerAnalyses,
      companyTargets,
      companyReviews,
      auditLogs,
    };
    const filename = `jobpilot-account-export-${new Date().toISOString().slice(0, 10)}.json`;
    return NextResponse.json(payload, { headers: { "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    // Remove uploaded CVs and generated application documents before deleting
    // the account row. If storage cleanup fails, keep the account intact so the
    // user can retry instead of silently leaving private files behind.
    await deleteUserFiles(user.id);
    await transaction(async (db) => {
      // Legacy manual imports have no owner_user_id. Attribute only rows that
      // this account references and no other account references, then remove
      // them as part of this account's deletion. Shared or unreferenced legacy
      // rows are left intact because their owner cannot be proven.
      await db.run(
        `DELETE FROM jobs
         WHERE source='manual' AND owner_user_id IS NULL
           AND id IN (
             SELECT job_id FROM applications WHERE user_id=?
             UNION SELECT job_id FROM job_matches WHERE user_id=?
             UNION SELECT job_id FROM saved_jobs WHERE user_id=?
             UNION SELECT job_id FROM resume_versions WHERE user_id=? AND job_id IS NOT NULL
           )
           AND NOT EXISTS (
             SELECT 1 FROM (
               SELECT job_id, user_id FROM applications
               UNION ALL SELECT job_id, user_id FROM job_matches
               UNION ALL SELECT job_id, user_id FROM saved_jobs
               UNION ALL SELECT job_id, user_id FROM resume_versions WHERE job_id IS NOT NULL
             ) AS other_refs
             WHERE other_refs.job_id=jobs.id AND other_refs.user_id<>?
           )`,
        [user.id, user.id, user.id, user.id, user.id],
      );
      const result = await db.run("DELETE FROM users WHERE id=?", [user.id]);
      if (affectedRows(result) !== 1) throw new Error("Account deletion did not remove the expected record.");
    });
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as Error & { status: number }).status) : 500;
    return NextResponse.json({ error: status < 500 ? error instanceof Error ? error.message : "Unable to delete account." : "Unable to securely delete account data. Please retry." }, { status });
  }
}






