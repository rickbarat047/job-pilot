import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getPreferences, savePreferences } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ preferences: await getPreferences(user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const preferences = await savePreferences(user.id, body);
    return NextResponse.json({ preferences });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save preferences." }, { status: 400 });
  }
}
