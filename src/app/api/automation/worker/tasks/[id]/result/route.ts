import { NextResponse } from "next/server";
import { recordWorkerResult, type WorkerTaskStatus } from "@/lib/worker-tasks";
import { verifyWorkerToken } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: WorkerTaskStatus[] = ["applied", "manual_required", "failed"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  if (!verifyWorkerToken(request, body?.token)) {
    return NextResponse.json({ error: "Invalid worker token." }, { status: 401 });
  }
  const status = body?.status as WorkerTaskStatus;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Status must be applied, manual_required or failed." }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const result = await recordWorkerResult(id, {
      status,
      message: typeof body.message === "string" ? body.message : "",
      confirmation: typeof body.confirmation === "string" ? body.confirmation : undefined,
      finalUrl: typeof body.finalUrl === "string" ? body.finalUrl : undefined,
      fieldsFilled: Array.isArray(body.fieldsFilled) ? body.fieldsFilled.filter((item: unknown) => typeof item === "string") : undefined,
      screenshotPath: typeof body.screenshotPath === "string" ? body.screenshotPath : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record worker result." }, { status: 400 });
  }
}
