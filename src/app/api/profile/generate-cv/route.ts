import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getProfile, getPreferences, getPermissionsForUser } from "@/lib/repositories";
import { saveProfile } from "@/lib/repositories";
import { tailorApplication } from "@/lib/ai/tailor";
import { generateResumeDocuments } from "@/lib/documents/generate";
import { getJobById } from "@/lib/repositories";
import { newId, nowIso, run } from "@/lib/db";
import { createNotification } from "@/lib/repositories";

// Reuse tailor engine with a synthetic job-like target so the generated CV is
// professional and ATS-friendly without inventing any candidate facts.
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const permissions = await getPermissionsForUser(user.id);
    if (permissions.generateResumes !== "automatic" && permissions.generateResumes !== "approval") {
      return NextResponse.json({ error: "Resume generation is disabled in your permissions." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetRole = String(body.targetRole ?? "Professional").trim() || "Professional";
    const profile = await getProfile(user.id);
    const prefs = await getPreferences(user.id);

    // Save any details submitted from the CV builder form.
    if (body.profile && typeof body.profile === "object") {
      await saveProfile(user.id, body.profile);
    }
    const updatedProfile = body.profile ? await getProfile(user.id) : profile;

    const syntheticJob = {
      id: `cv-builder:${user.id}`,
      source: "cv-builder",
      sourceJobId: user.id,
      title: targetRole,
      companyName: "General application",
      companySlug: "general",
      description: `${targetRole} role. Candidate skills: ${updatedProfile.skills.map((s: { name: string }) => s.name).join(", ")}.`,
      location: updatedProfile.city || "India",
      city: updatedProfile.city || null,
      country: updatedProfile.country || "India",
      remoteStatus: "unknown" as const,
      employmentType: "full-time" as const,
      skillsRequired: updatedProfile.skills.map((s: { name: string }) => s.name),
      applicationUrl: "",
      applicationMethod: "external" as const,
      postedAt: nowIso(),
      lastVerifiedAt: nowIso(),
      status: "active" as const,
      reliability: 1,
      fingerprint: `cv-builder:${user.id}:${targetRole}`,
    };

    const match = {
      overallScore: 100,
      skillScore: 100,
      educationScore: 100,
      experienceScore: 100,
      careerScore: 100,
      locationScore: 100,
      salaryScore: 100,
      flexibilityScore: 100,
      freshnessScore: 100,
      strengths: updatedProfile.skills.map((s: { name: string }) => s.name).slice(0, 8),
      gaps: [],
      missingRequirements: [],
      disqualifiers: [],
      explanation: "Base CV generated from your verified profile details.",
      recommendedAction: "Use this as your master CV.",
      qualified: true,
      roleFamily: targetRole,
      semanticSummary: null,
    };

    const tailored = await tailorApplication(updatedProfile, prefs, syntheticJob as any, match as any);
    const baseDir = `users/${user.id}/cv-builder/${newId("cv")}`;
    const docs = await generateResumeDocuments(baseDir, tailored.resume);

    const resumeVersionId = newId("rv");
    const now = nowIso();
    await run(
      `INSERT INTO resume_versions (id, user_id, job_id, title, kind, content_json, file_pdf_path, file_docx_path, ats_keywords, customization_notes, provider, created_at)
       VALUES (?, ?, NULL, ?, 'base_resume', ?, ?, ?, ?, ?, ?, ?)`,
      [resumeVersionId, user.id, `Base CV — ${targetRole}`, JSON.stringify(tailored.resume), docs.pdfPath, docs.docxPath, JSON.stringify(tailored.atsKeywords), JSON.stringify(tailored.customizationNotes), tailored.provider, now],
    );

    await createNotification(user.id, "cv", "AI CV generated", `Your base CV for ${targetRole} is ready to download.`, `/profile`);

    return NextResponse.json({ resumeVersionId, pdfPath: docs.pdfPath, docxPath: docs.docxPath, provider: tailored.provider, notes: tailored.customizationNotes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate CV." }, { status: 400 });
  }
}
