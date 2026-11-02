import { NextResponse } from "next/server";
import path from "node:path";
import { get, parseJson } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { verifyWorkerToken } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyWorkerToken(request)) {
    return NextResponse.json({ error: "Invalid worker token." }, { status: 401 });
  }
  const { id } = await context.params;
  const taskId = new URL(request.url).searchParams.get("taskId") ?? "";
  if (!taskId) return NextResponse.json({ error: "taskId is required." }, { status: 400 });

  const task = await get<{ user_id: string; payload: unknown; type: string }>(
    "SELECT user_id, payload, type FROM automation_tasks WHERE id = ?",
    [taskId],
  );
  if (!task || task.type !== "browser-apply") {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  const payload = parseJson<Record<string, unknown>>(task.payload, {});
  const applicationId = typeof payload.applicationId === "string" ? payload.applicationId : "";
  if (!applicationId) return NextResponse.json({ error: "Task has no application." }, { status: 404 });

  const doc = await get<{ id: string; filename: string; path: string }>(
    "SELECT id, filename, path FROM application_documents WHERE id = ? AND application_id = ?",
    [id, applicationId],
  );
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    const buffer = await readFile(doc.path);
    const ext = path.extname(doc.path).toLowerCase();
    const contentType = ext === ".pdf"
      ? "application/pdf"
      : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${path.basename(doc.filename).replace(/["\\]/g, "")}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read document." }, { status: 404 });
  }
}
