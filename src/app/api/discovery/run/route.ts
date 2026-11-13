import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { runDiscovery, rescoreMatches } from "@/lib/discovery";
import { ensureBootstrap } from "@/lib/bootstrap";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rate = await checkRateLimit(`discovery:${ip}`, 5, 15 * 60 * 1000);
    if (!rate.ok) {
      const status = rate.unavailable ? 503 : 429;
      const message = rate.unavailable ? "Rate limiting is unavailable. Try again later." : "Too many requests. Try again later.";
      return NextResponse.json({ error: message }, { status });
    }
    const user = await requireApiUser();
    await ensureBootstrap();
    const body = await request.json().catch(() => ({}));
    const result = await runDiscovery(user.id, { sourceKeys: body.sourceKeys, match: true });
    const rescored = body.rescore === false ? 0 : await rescoreMatches(user.id);
    return NextResponse.json({ ...result, rescored });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed." }, { status: 400 });
  }
}
