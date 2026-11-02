import { NextResponse } from "next/server";
import { claimWorkerTask, getWorkerTaskPayload } from "@/lib/worker-tasks";
import { verifyWorkerToken } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!verifyWorkerToken(request, body?.token)) {
    return NextResponse.json({ error: "Invalid worker token." }, { status: 401 });
  }

  const task = await claimWorkerTask();
  if (!task) return NextResponse.json({ task: null });

  const baseUrl = process.env.APP_URL || new URL(request.url).origin;
  try {
    const payload = await getWorkerTaskPayload(String(task.id), baseUrl);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();
    const { run } = await import("@/lib/db");
    await run(
      "UPDATE automation_tasks SET status='failed', last_error=?, locked_at=NULL, updated_at=? WHERE id=?",
      [message.slice(0, 4000), now, String(task.id)],
    );
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
