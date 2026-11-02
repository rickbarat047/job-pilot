import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { importManualJob } from "@/lib/jobs/import";
import { upsertJob } from "@/lib/discovery";
import { getProfile, getPreferences } from "@/lib/repositories";
import { matchJob } from "@/lib/matching";
import { getJobById } from "@/lib/repositories";
import { newId, nowIso, run, get } from "@/lib/db";
import { createNotification } from "@/lib/repositories";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const job = await importManualJob(body);
    const result = await upsertJob(job);
    const profile = await getProfile(user.id);
    const prefs = await getPreferences(user.id);
    const storedJob = await getJobById(result.id);
    if (storedJob) {
      const match = matchJob(profile, prefs, storedJob);
      const existing = await get<{ id: string }>("SELECT id FROM job_matches WHERE user_id = ? AND job_id = ?", [user.id, result.id]);
      if (existing) {
        await run("UPDATE job_matches SET overall_score=?, explanation=?, recommended_action=?, qualified=?, updated_at=? WHERE id=?", [match.overallScore, match.explanation, match.recommendedAction, match.qualified ? 1 : 0, nowIso(), existing.id]);
      } else {
        await run("INSERT INTO job_matches (id, user_id, job_id, overall_score, skill_score, education_score, experience_score, career_score, location_score, salary_score, flexibility_score, freshness_score, strengths, gaps, missing_requirements, disqualifiers, explanation, recommended_action, qualified, role_family, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [newId("mat"), user.id, result.id, match.overallScore, match.skillScore, match.educationScore, match.experienceScore, match.careerScore, match.locationScore, match.salaryScore, match.flexibilityScore, match.freshnessScore, JSON.stringify(match.strengths), JSON.stringify(match.gaps), JSON.stringify(match.missingRequirements), JSON.stringify(match.disqualifiers), match.explanation, match.recommendedAction, match.qualified ? 1 : 0, match.roleFamily, nowIso(), nowIso()]);
      }
    }
    return NextResponse.json({ jobId: result.id, isNew: result.isNew });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import job." }, { status: 400 });
  }
}

