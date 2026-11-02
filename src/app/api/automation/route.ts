import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getAutomationOverview, getPermissionsForUser } from "@/lib/repositories";
import { enqueueTask, processAutomationTasks, retryTask } from "@/lib/automation";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getAutomationOverview(user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json().catch(() => ({}));
    if (body.action === "run") {
      const result = await processAutomationTasks(user.id, 6);
      return NextResponse.json(result);
    }
    if (body.action === "enqueue") {
      const id = await enqueueTask(user.id, body.type ?? "discovery", body.payload ?? {}, body.priority ?? 5);
      return NextResponse.json({ id });
    }
    if (body.action === "retry" && body.taskId) {
      await retryTask(user.id, body.taskId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update automation." }, { status: 400 });
  }
}
