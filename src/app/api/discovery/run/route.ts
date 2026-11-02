import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { runDiscovery } from "@/lib/discovery";
import { ensureBootstrap } from "@/lib/bootstrap";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    await ensureBootstrap();
    const body = await request.json().catch(() => ({}));
    const result = await runDiscovery(user.id, { sourceKeys: body.sourceKeys, match: true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed." }, { status: 400 });
  }
}
