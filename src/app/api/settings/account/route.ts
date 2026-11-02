import { NextResponse } from "next/server";
import { requireApiUser, destroySession } from "@/lib/auth";
import { get, run, nowIso } from "@/lib/db";
import { getProfile, getPreferences } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    const profile = await getProfile(user.id);
    const preferences = await getPreferences(user.id);
    const applications = Number((await get<{ c: number | string }>("SELECT COUNT(*) as c FROM applications WHERE user_id = ?", [user.id]))?.c ?? 0);
    const jobs = Number((await get<{ c: number | string }>("SELECT COUNT(*) as c FROM job_matches WHERE user_id = ?", [user.id]))?.c ?? 0);
    return NextResponse.json({ exportedAt: nowIso(), user: { id: user.id, email: user.email, name: user.name }, profile, preferences, counts: { applications, matchedJobs: jobs } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireApiUser();
    await run("UPDATE users SET deleted_at=?, updated_at=? WHERE id=?", [nowIso(), nowIso(), user.id]);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete account." }, { status: 400 });
  }
}






