import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getSources } from "@/lib/repositories";
import { ensureBootstrap } from "@/lib/bootstrap";

export async function GET() {
  try {
    await requireApiUser();
    await ensureBootstrap();
    return NextResponse.json({ sources: await getSources() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
