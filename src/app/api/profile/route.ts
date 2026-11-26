import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getProfile, saveProfile } from "@/lib/repositories";
import { parseCv } from "@/lib/documents/parse";
import { validateCvUpload } from "@/lib/documents/upload-validation";
import { deleteFile, writeFile } from "@/lib/storage";
import { newId } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ profile: await getProfile(user.id) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const profile = await saveProfile(user.id, body);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Unable to save profile." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    // Validate type, magic bytes and extension BEFORE persisting the file.
    const validation = validateCvUpload({
      name: file.name,
      type: file.type,
      size: file.size,
      bytes: new Uint8Array(buffer),
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error || "Unsupported file." }, { status: 400 });
    }

    const relativePath = `users/${user.id}/cv/${newId("cv")}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await writeFile(relativePath, buffer);
    try {
      const { text, parsed, warnings } = await parseCv(buffer, file.type, file.name);
      const current = await getProfile(user.id);
      const mergedSkills = [...new Set([...current.skills.map((s) => s.name), ...parsed.skills])].map((name) => ({ name }));
      const profile = await saveProfile(user.id, { ...parsed, skills: mergedSkills, rawCvText: text });
      const { run } = await import("@/lib/db");
      await run(
        "INSERT INTO uploaded_resumes (id, user_id, filename, mime_type, size, storage_path, parsed_text, parse_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'parsed', ?)",
        [newId("res"), user.id, file.name, file.type || "application/octet-stream", file.size, relativePath, text, new Date().toISOString()],
      );
      return NextResponse.json({ profile, warnings, extracted: parsed });
    } catch (error) {
      // Never leave an unparsed or partially processed PII file behind.
      await deleteFile(relativePath).catch(() => undefined);
      console.error("[profile-upload] processing failed", error instanceof Error ? error.name : "unknown");
      return NextResponse.json({ error: "Unable to process the uploaded CV." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Unable to upload CV." }, { status: 400 });
  }
}
