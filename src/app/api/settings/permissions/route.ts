import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPermissionsForUser, savePermissions } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ permissions: await getPermissionsForUser(user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    await savePermissions(user.id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save permissions." }, { status: 400 });
  }
}
