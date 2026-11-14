import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";
import { nowIso, newId, transaction } from "@/lib/db";
import { generateCoverLetterDocuments, generateResumeDocuments } from "@/lib/documents/generate";
import type { CoverLetterContent, ResumeContent } from "@/lib/types";
import { deleteFile } from "@/lib/storage";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (!["Draft Ready", "Awaiting Approval"].includes(detail.application.state)) {
      return NextResponse.json({ error: "Materials can only be edited before approving the application." }, { status: 409 });
    }

    const body = await request.json();
    const validText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
    if (body.summary !== undefined && !validText(body.summary, 2000)) {
      return NextResponse.json({ error: "The resume summary must contain 1–2,000 characters." }, { status: 400 });
    }
    if (body.coverLetterText !== undefined && !validText(body.coverLetterText, 12000)) {
      return NextResponse.json({ error: "The cover letter must contain 1–12,000 characters." }, { status: 400 });
    }
    if (body.emailSubject !== undefined && !validText(body.emailSubject, 300)) {
      return NextResponse.json({ error: "The recruiter email subject must contain 1–300 characters." }, { status: 400 });
    }
    if (body.emailBody !== undefined && !validText(body.emailBody, 12000)) {
      return NextResponse.json({ error: "The recruiter email must contain 1–12,000 characters." }, { status: 400 });
    }
    if (body.emailSubject !== undefined || body.emailBody !== undefined) {
      if (!detail.email || detail.email.status !== "draft") {
        return NextResponse.json({ error: "This recruiter email is no longer an editable draft." }, { status: 409 });
      }
    }
    if (body.summary === undefined && body.coverLetterText === undefined && body.emailSubject === undefined && body.emailBody === undefined) {
      return NextResponse.json({ error: "No editable materials were provided." }, { status: 400 });
    }

    const now = nowIso();
    let documentRevision: {
      resume: ResumeContent;
      coverLetter: CoverLetterContent;
      resumeDocs: Awaited<ReturnType<typeof generateResumeDocuments>>;
      coverDocs: Awaited<ReturnType<typeof generateCoverLetterDocuments>>;
      resumeId: string;
      coverLetterId: string;
    } | null = null;
    let newPaths: string[] = [];
    let oldPaths: string[] = [];
    if (body.summary !== undefined || body.coverLetterText !== undefined) {
      if (!detail.resume || !detail.coverLetter || !detail.resume.id || !detail.coverLetter.id) {
        return NextResponse.json({ error: "Generated resume or cover letter was not found." }, { status: 409 });
      }
      const resume = { ...detail.resume.content, summary: body.summary ?? detail.resume.content.summary } as unknown as ResumeContent;
      const coverLetter = { ...detail.coverLetter.content, text: body.coverLetterText ?? detail.coverLetter.content.text } as unknown as CoverLetterContent;
      if (typeof resume.header?.name !== "string" || typeof resume.targetRole !== "string" || typeof resume.company !== "string" || typeof coverLetter.targetRole !== "string" || typeof coverLetter.company !== "string") {
        return NextResponse.json({ error: "Generated materials could not be safely updated." }, { status: 409 });
      }
      const revision = newId("rev");
      const baseDir = `users/${user.id}/applications/${id}/revisions/${revision}`;
      const resumeDocs = await generateResumeDocuments(baseDir, resume);
      newPaths.push(resumeDocs.pdfPath, resumeDocs.docxPath);
      let coverDocs: Awaited<ReturnType<typeof generateCoverLetterDocuments>>;
      try {
        coverDocs = await generateCoverLetterDocuments(baseDir, coverLetter, resume.header.name);
      } catch (error) {
        await Promise.all(newPaths.map((file) => deleteFile(file)));
        throw error;
      }
      documentRevision = { resume, coverLetter, resumeDocs, coverDocs, resumeId: detail.resume.id, coverLetterId: detail.coverLetter.id };
      newPaths.push(coverDocs.pdfPath, coverDocs.docxPath);
      oldPaths = [detail.resume.pdf, detail.resume.docx, detail.coverLetter.pdf, detail.coverLetter.docx].filter((file): file is string => Boolean(file));
    }

    try {
      await transaction(async (db) => {
        if (documentRevision) {
          const { resume, coverLetter, resumeDocs, coverDocs, resumeId, coverLetterId } = documentRevision;
          await db.run("UPDATE resume_versions SET content_json=?, file_pdf_path=?, file_docx_path=? WHERE id=? AND user_id=?", [JSON.stringify(resume), resumeDocs.pdfPath, resumeDocs.docxPath, resumeId, user.id]);
          await db.run("UPDATE resume_versions SET content_json=?, file_pdf_path=?, file_docx_path=? WHERE id=? AND user_id=?", [JSON.stringify(coverLetter), coverDocs.pdfPath, coverDocs.docxPath, coverLetterId, user.id]);
          await db.run("UPDATE application_documents SET path=? WHERE application_id=? AND resume_version_id=? AND kind='resume'", [resumeDocs.pdfPath, id, resumeId]);
          await db.run("UPDATE application_documents SET path=? WHERE application_id=? AND resume_version_id=? AND kind='cover_letter'", [coverDocs.pdfPath, id, coverLetterId]);
        }
        if (detail.email && detail.email.status === "draft" && (body.emailSubject !== undefined || body.emailBody !== undefined)) {
          await db.run("UPDATE email_messages SET subject=?, body=? WHERE id=? AND user_id=? AND application_id=? AND status='draft'", [body.emailSubject ?? detail.email.subject, body.emailBody ?? detail.email.body, detail.email.id, user.id, id]);
        }
        await db.run("UPDATE applications SET updated_at=? WHERE id=? AND user_id=?", [now, id, user.id]);
        await db.run(
          "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, 'application.materials_edited', ?, ?, ?, ?)",
          [newId("evt"), id, user.id, detail.application.state, detail.application.state, JSON.stringify({ resumeSummaryEdited: body.summary !== undefined, coverLetterEdited: body.coverLetterText !== undefined, recruiterEmailEdited: body.emailSubject !== undefined || body.emailBody !== undefined }), now],
        );
      });
    } catch (error) {
      await Promise.all(newPaths.map((file) => deleteFile(file)));
      throw error;
    }
    await Promise.all(oldPaths.map((file) => deleteFile(file)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save materials." }, { status: 400 });
  }
}
