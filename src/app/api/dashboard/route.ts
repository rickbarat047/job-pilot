import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDashboard } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getDashboard(user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
