import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isAIEnabled, chatJSON, sanitizeExternalText, injectionGuard } from "@/lib/ai/provider";
import { extractSkills, canonicalSkill } from "@/lib/taxonomy";
import { z } from "zod";

const schema = z.object({
  summary: z.string().min(20).max(1000),
  suggestedSkills: z.array(z.string()).max(20),
});

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await request.json().catch(() => ({}));
    const targetRole = String(body.targetRole ?? "Professional").trim() || "Professional";
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};

    const facts = {
      fullName: profile.fullName ?? "",
      degree: profile.degree ?? "",
      university: profile.university ?? "",
      graduationYear: profile.graduationYear ?? "",
      cgpa: profile.cgpa ?? "",
      currentStatus: profile.currentStatus ?? "",
      skills: Array.isArray(profile.skills) ? profile.skills.map((s: { name: string }) => s.name) : [],
      projects: Array.isArray(profile.projects) ? profile.projects : [],
      internships: Array.isArray(profile.internships) ? profile.internships : [],
      certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
      summary: profile.summary ?? "",
      targetRole,
    };

    const combinedText = [
      facts.degree, facts.summary,
      ...(facts.skills as string[]),
      ...facts.projects.map((p: { name?: string; description?: string; technologies?: string[] }) => `${p.name ?? ""} ${p.description ?? ""} ${(p.technologies ?? []).join(" ")}`),
      ...facts.internships.map((e: { role?: string; company?: string; description?: string }) => `${e.role ?? ""} ${e.company ?? ""} ${e.description ?? ""}`),
      ...facts.certifications,
    ].join(" ");

    const deterministicSkills = [...new Set(extractSkills(`${targetRole} ${combinedText}`, 18).map((skill) => canonicalSkill(skill)))];
    const deterministicSummary = facts.summary?.trim()
      ? `${facts.summary.trim()} Targeting ${targetRole} roles and highlighting ${((facts.skills as string[]).slice(0, 5).join(", ") || "transferable academic and project skills")}.`
      : `${facts.fullName || "The candidate"} is a ${facts.degree || "graduate"}${facts.university ? ` from ${facts.university}` : ""} targeting ${targetRole} roles, with strengths in ${((facts.skills as string[]).slice(0, 5).join(", ") || "problem solving, communication, and learning agility")} developed through academic and project work.`;

    if (!isAIEnabled()) {
      return NextResponse.json({ summary: deterministicSummary, suggestedSkills: deterministicSkills, provider: "deterministic" });
    }

    try {
      const result = await chatJSON(
        [
          { role: "system", content: `You assist a job seeker with CV writing. ${injectionGuard()} Never invent facts, metrics, employers, degrees, or skills. Return JSON only.` },
          {
            role: "user",
            content: `Candidate facts (JSON):
${JSON.stringify(facts, null, 2)}

Untrusted target role text:
<untrusted_target_role>${sanitizeExternalText(targetRole, 120)}</untrusted_target_role>

Return JSON with:
- summary: a 3-4 sentence professional CV summary using only the facts above.
- suggestedSkills: up to 12 skills to consider adding, only if they are clearly supported by the degree, projects, experience, certifications, or explicitly listed skills. Do not invent tools or technologies not mentioned.`,
          },
        ],
        schema,
      );
      const cleanedSkills = [...new Set(result.suggestedSkills.map((skill) => canonicalSkill(skill)))].slice(0, 12);
      return NextResponse.json({ summary: result.summary, suggestedSkills: cleanedSkills.length ? cleanedSkills : deterministicSkills, provider: "ai" });
    } catch {
      return NextResponse.json({ summary: deterministicSummary, suggestedSkills: deterministicSkills, provider: "deterministic" });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate AI assistance." }, { status: 400 });
  }
}
