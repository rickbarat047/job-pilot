import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getResumeVersions } from "@/lib/repositories";

export async function GET() {
  try {
    const user = await requireApiUser();
    const versions = await getResumeVersions(user.id, 50);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load resume versions." }, { status: 400 });
  }
}
