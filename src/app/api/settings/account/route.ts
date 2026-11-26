import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiUser, destroySession } from "@/lib/auth";
import { all, get, run, nowIso } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { getProfile, getPreferences } from "@/lib/repositories";

/**
 * Storage is namespaced as `users/<id>/...`. Never pass a path to deleteFile
 * unless it resolves inside the authenticated user's own namespace: a bad row
 * (or a crafted path) must never be able to remove another user's documents.
 */
function ownedStoragePaths(userId: string, candidates: (string | null | undefined)[]): string[] {
  const prefix = `users/${userId}/`;
  const owned = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.length === 0) continue;
    if (candidate.includes("\\") || candidate.includes("\u0000")) continue;
    const normalized = path.posix.normalize(candidate);
    if (path.posix.isAbsolute(normalized)) continue;
    if (!normalized.startsWith(prefix)) continue;
    if (normalized === prefix || normalized === `users/${userId}`) continue;
    if (normalized.split("/").includes("..")) continue;
    owned.add(normalized);
  }
  return [...owned];
}

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
    // Collect every file this user owns. A soft-deleted user row alone leaves
    // PII (uploaded CVs, tailored resumes, cover letters, attachments) on disk.
    const [resumes, resumeVersions, applicationDocuments] = await Promise.all([
      all<{ storage_path: string }>(
        "SELECT storage_path FROM uploaded_resumes WHERE user_id = ?",
        [user.id],
      ),
      all<{ file_pdf_path: string | null; file_docx_path: string | null }>(
        "SELECT file_pdf_path, file_docx_path FROM resume_versions WHERE user_id = ?",
        [user.id],
      ),
      all<{ path: string }>(
        "SELECT d.path FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE a.user_id = ?",
        [user.id],
      ),
    ]);

    // Ownership check + dedupe: the same generated PDF is referenced by both
    // resume_versions and application_documents.
    const paths = ownedStoragePaths(user.id, [
      ...resumes.map((resume) => resume.storage_path),
      ...resumeVersions.flatMap((version) => [version.file_pdf_path, version.file_docx_path]),
      ...applicationDocuments.map((document) => document.path),
    ]);

    // A failed bucket/filesystem delete must not abort the account deletion.
    // Report it server-side so an operator can clean up the orphaned object.
    const failedPaths: string[] = [];
    for (const relativePath of paths) {
      try {
        await deleteFile(relativePath);
      } catch {
        failedPaths.push(relativePath);
      }
    }
    if (failedPaths.length > 0) {
      console.error(
        "[account-cleanup] storage deletion failed",
        JSON.stringify({ userId: user.id, failedPaths }),
      );
    }

    // Drop storage metadata once its files have been dealt with. All statements
    // are scoped by the authenticated user id; no auth/approval rule is changed.
    await run("DELETE FROM uploaded_resumes WHERE user_id = ?", [user.id]);
    if (resumeVersions.length > 0) {
      await run("DELETE FROM resume_versions WHERE user_id = ?", [user.id]);
    }
    if (applicationDocuments.length > 0) {
      await run(
        "DELETE FROM application_documents WHERE id IN (SELECT d.id FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE a.user_id = ?)",
        [user.id],
      );
    }
    const now = nowIso();
    await run("UPDATE users SET deleted_at=?, updated_at=? WHERE id=?", [now, now, user.id]);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete account." }, { status: 400 });
  }
}
