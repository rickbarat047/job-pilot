import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getJobDetailForUser, getProfile, getPreferences, getPermissionsForUser, getJobById, createNotification } from "@/lib/repositories";
import { tailorApplication } from "@/lib/ai/tailor";
import { generateResumeDocuments, generateCoverLetterDocuments } from "@/lib/documents/generate";
import { applicationDuplicateKey } from "@/lib/dedupe";
import { evaluatePermission, assertPermission } from "@/lib/permissions";
import { getDb, newId, nowIso, run, get } from "@/lib/db";
import { relativeStoragePath } from "@/lib/storage";
import { getVerifiedRecruiterContact } from "@/lib/companies/contacts";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ip = clientIp(_request);
    const rate = await checkRateLimit(`tailor:${ip}`, 10, 15 * 60 * 1000);
    if (!rate.ok) {
      const status = rate.unavailable ? 503 : 429;
      const message = rate.unavailable ? "Rate limiting is unavailable. Try again later." : "Too many requests. Try again later.";
      return NextResponse.json({ error: message }, { status });
    }
    const user = await requireApiUser();
    const { id: jobId } = await context.params;
    const permissions = await getPermissionsForUser(user.id);
    assertPermission(permissions, "generate_resume");
    assertPermission(permissions, "generate_cover_letter");
    assertPermission(permissions, "save_draft");

    const detail = await getJobDetailForUser(user.id, jobId);
    if (!detail) return NextResponse.json({ error: "Job not found. Run discovery first." }, { status: 404 });
    const profile = await getProfile(user.id);
    const prefs = await getPreferences(user.id);
    const job = await getJobById(jobId);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const duplicateKey = applicationDuplicateKey(user.id, job.companyName, job.title);
    const existing = await get<{ id: string; state: string }>("SELECT id, state FROM applications WHERE user_id = ? AND duplicate_key = ?", [user.id, duplicateKey]);
    if (existing && !permissions.allowDuplicateApplications) {
      return NextResponse.json({ error: "You already have an application for this role.", existingApplicationId: existing.id }, { status: 409 });
    }

    const match = detail.match;
    const verifiedContact = await getVerifiedRecruiterContact(job.companySlug);
    const tailored = await tailorApplication(profile, prefs, job, match as never);
    if (verifiedContact) {
      tailored.recruiterEmail.to = verifiedContact.email;
      tailored.recruiterEmail.source = "verified_public";
    }

    const baseDir = `users/${user.id}/applications/${newId("app")}`;
    const resumeDocs = await generateResumeDocuments(baseDir, tailored.resume);
    const coverDocs = await generateCoverLetterDocuments(baseDir, tailored.coverLetter, profile.fullName);

    const resumeVersionId = newId("rv");
    const coverVersionId = newId("rv");
    const now = nowIso();
    await run(
      `INSERT INTO resume_versions (id, user_id, job_id, title, kind, content_json, file_pdf_path, file_docx_path, ats_keywords, customization_notes, provider, created_at)
       VALUES (?, ?, ?, ?, 'resume', ?, ?, ?, ?, ?, ?, ?)`,
      [resumeVersionId, user.id, jobId, `Tailored resume — ${job.title}`, JSON.stringify(tailored.resume), resumeDocs.pdfPath, resumeDocs.docxPath, JSON.stringify(tailored.atsKeywords), JSON.stringify(tailored.customizationNotes), tailored.provider, now],
    );
    await run(
      `INSERT INTO resume_versions (id, user_id, job_id, title, kind, content_json, file_pdf_path, file_docx_path, ats_keywords, customization_notes, provider, created_at)
       VALUES (?, ?, ?, ?, 'cover_letter', ?, ?, ?, ?, '[]', ?, ?)`,
      [coverVersionId, user.id, jobId, `Cover letter — ${job.title}`, JSON.stringify(tailored.coverLetter), coverDocs.pdfPath, coverDocs.docxPath, JSON.stringify(tailored.atsKeywords), tailored.provider, now],
    );

    const applicationId = newId("app");
    const approvalRequired = evaluatePermission(permissions, "submit_application").requiresApproval;
    await run(
      `INSERT INTO applications (id, user_id, job_id, company_id, state, autonomy_level, application_method, match_score, resume_version_id, cover_letter_id, approval_required, last_event_at, notes, duplicate_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Draft Ready', ?, 'external', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [applicationId, user.id, jobId, null, permissions.autonomyLevel, detail.match.overallScore, resumeVersionId, coverVersionId, approvalRequired ? 1 : 0, now, tailored.customizationNotes.join(" "), duplicateKey, now, now],
    );
    await run("INSERT INTO application_documents (id, application_id, resume_version_id, kind, filename, path, created_at) VALUES (?, ?, ?, 'resume', ?, ?, ?)", [newId("doc"), applicationId, resumeVersionId, `resume-${job.title}.pdf`, resumeDocs.pdfPath, now]);
    await run("INSERT INTO application_documents (id, application_id, resume_version_id, kind, filename, path, created_at) VALUES (?, ?, ?, 'cover_letter', ?, ?, ?)", [newId("doc"), applicationId, coverVersionId, `cover-letter-${job.title}.pdf`, coverDocs.pdfPath, now]);

    const recruiterEmailId = newId("eml");
    await run(
      "INSERT INTO email_messages (id, user_id, application_id, to_email, subject, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)",
      [recruiterEmailId, user.id, applicationId, tailored.recruiterEmail.to, tailored.recruiterEmail.subject, tailored.recruiterEmail.body, now],
    );
    await run("UPDATE applications SET recruiter_email_id = ? WHERE id = ?", [recruiterEmailId, applicationId]);

    for (const question of tailored.questions) {
      await run(
        "INSERT INTO application_questions (id, application_id, question, answer, requires_approval, sensitive, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)",
        [newId("q"), applicationId, question.question, question.answer, question.requiresApproval ? 1 : 0, question.sensitive ? 1 : 0, now],
      );
    }
    await run(
      "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.drafted', NULL, 'Draft Ready', ?, ?)",
      [newId("evt"), applicationId, user.id, JSON.stringify({ provider: tailored.provider, matchScore: detail.match.overallScore }), now],
    );
    await createNotification(user.id, "draft", "Application draft ready", `${job.title} at ${job.companyName} has a tailored draft waiting for your review.`, `/applications/${applicationId}`);

    return NextResponse.json({ applicationId, provider: tailored.provider, customizationNotes: tailored.customizationNotes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to tailor application." }, { status: 400 });
  }
}

