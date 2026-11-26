import { NextResponse } from "next/server";
import { requireApiUser, destroySession } from "@/lib/auth";
import { all, get, run, nowIso } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { getProfile, getPreferences } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    const profile = await getProfile(user.id);
    const preferences = await getPreferences(user.id);
    const applications = Number((await get<{ c: number | string }>("SELECT COUNT(*) as c FROM applications WHERE user_id = ?", [user.id]))?.c ?? 0);
    const jobs = Number((await get<{ c: number | string }>("SELECT COUNT(*) as c FROM job_matches WHERE user_id = ?", [user.id]))?.c ?? 0);
    return NextResponse.json({ exportedAt: nowIso(), user: { id: user.id, email: user.email, name: user.name }, profile, preferences, counts: { applications, matchedJobs: jobs } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireApiUser();
    // Remove the uploaded CV files themselves before dropping their metadata:
    // a soft-deleted user row alone leaves PII on disk / in the storage bucket.
    const resumes = await all<{ storage_path: string }>(
      "SELECT storage_path FROM uploaded_resumes WHERE user_id = ?",
      [user.id],
    );
    await Promise.all(resumes.map((resume) => deleteFile(resume.storage_path).catch(() => undefined)));
    await run("DELETE FROM uploaded_resumes WHERE user_id = ?", [user.id]);
    await run("UPDATE users SET deleted_at=?, updated_at=? WHERE id=?", [nowIso(), nowIso(), user.id]);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete account." }, { status: 400 });
  }
}
