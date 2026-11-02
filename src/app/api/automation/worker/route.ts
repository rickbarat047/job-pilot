import { NextResponse } from "next/server";
import { updateWorkerHeartbeat, workerIsOnline } from "@/lib/automation";
import { get, parseJson } from "@/lib/db";
import { verifyWorkerToken } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const row = await get<{ status: string; last_heartbeat: string | null; meta: string }>("SELECT status, last_heartbeat, meta FROM worker_status WHERE id='playwright-worker'");
  return NextResponse.json({
    status: row?.status ?? "offline",
    lastHeartbeat: row?.last_heartbeat ?? null,
    online: await workerIsOnline(),
    meta: parseJson<Record<string, unknown>>(row?.meta, {}),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!verifyWorkerToken(request, body?.token)) {
      return NextResponse.json({ error: "Invalid worker token." }, { status: 401 });
    }
    await updateWorkerHeartbeat(body.status === "offline" ? "offline" : "online", body.meta ?? {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update worker." }, { status: 400 });
  }
}
