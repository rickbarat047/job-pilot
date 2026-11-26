import { NextResponse } from "next/server";
import { updateWorkerHeartbeat, workerStatusSnapshot } from "@/lib/automation";
import { verifyWorkerToken } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One snapshot keeps online/recentlySeen/processing consistent for a single
// response; the legacy fields (status, lastHeartbeat, online, meta) are kept
// for existing consumers.
export async function GET() {
  const snapshot = await workerStatusSnapshot();
  return NextResponse.json({
    status: snapshot.status,
    lastHeartbeat: snapshot.lastHeartbeat,
    online: snapshot.online,
    meta: snapshot.meta,
    recentlySeen: snapshot.recentlySeen,
    processing: snapshot.processing,
    leaseExpiresAt: snapshot.leaseExpiresAt,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!verifyWorkerToken(request)) {
      return NextResponse.json({ error: "Invalid worker token." }, { status: 401 });
    }
    await updateWorkerHeartbeat(body.status === "offline" ? "offline" : "online", body.meta ?? {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update worker." }, { status: 400 });
  }
}
