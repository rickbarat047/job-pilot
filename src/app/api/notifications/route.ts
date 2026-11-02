import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getNotifications, markNotificationsRead } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ notifications: await getNotifications(user.id, 40) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json().catch(() => ({}));
    await markNotificationsRead(user.id, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update notifications." }, { status: 400 });
  }
}
