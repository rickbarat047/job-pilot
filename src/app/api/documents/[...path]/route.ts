import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { readFile, absoluteStoragePath } from "@/lib/storage";
import path from "node:path";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const user = await requireApiUser();
    const { path: segments } = await context.params;
    if (!Array.isArray(segments) || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\") || segment.includes("\u0000"))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const relative = path.posix.normalize(segments.join("/"));
    if (relative === "." || relative.startsWith("../") || relative.includes("/../") || !relative.startsWith(`users/${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const buffer = await readFile(relative);
    const ext = path.extname(relative).toLowerCase();
    const contentType = ext === ".pdf" ? "application/pdf" : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream";
    const safeName = path.basename(relative).replace(/[\r\n"]/g, "");
    return new NextResponse(new Uint8Array(buffer), { headers: { "content-type": contentType, "content-disposition": `inline; filename="${safeName}"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read document." }, { status: 404 });
  }
}
