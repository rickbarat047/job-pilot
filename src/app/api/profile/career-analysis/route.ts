import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getProfile, getPreferences } from "@/lib/repositories";
import { analyzeCareer } from "@/lib/ai/tailor";
import { getDb, newId, nowIso, run } from "@/lib/db";

export async function POST() {
  try {
    const user = await requireApiUser();
    const profile = await getProfile(user.id);
    const prefs = await getPreferences(user.id);
    const result = await analyzeCareer(profile, prefs);
    await run(
      "INSERT INTO career_analyses (id, user_id, paths, transferable_skills, summary, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newId("car"), user.id, JSON.stringify(result.paths), JSON.stringify(result.transferableSkills), result.summary, result.provider, nowIso()],
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to analyze career." }, { status: 400 });
  }
}

