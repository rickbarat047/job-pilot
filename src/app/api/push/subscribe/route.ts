import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { get, run, nowIso, newId } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const keys = body.keys && typeof body.keys === "object" ? body.keys : {};
    const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
    const auth = typeof keys.auth === "string" ? keys.auth : "";
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
    }
    const existing = await get<{ id: string }>("SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?", [user.id, endpoint]);
    if (existing) {
      await run("UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?", [p256dh, auth, existing.id]);
    } else {
      await run("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)", [newId("push"), user.id, endpoint, p256dh, auth, nowIso()]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) return NextResponse.json({ error: "endpoint required." }, { status: 400 });
    await run("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?", [user.id, endpoint]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}