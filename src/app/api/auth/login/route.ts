import { NextResponse } from "next/server";
import { authenticate, createSession, AuthError, audit, assertSameOrigin } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { nowIso, run } from "@/lib/db";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    const rate = await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!rate.ok) {
      const status = rate.unavailable ? 503 : 429;
      const message = rate.unavailable ? "Rate limiting is unavailable. Try again later." : "Too many attempts. Try again later.";
      return NextResponse.json({ error: message }, { status });
    }
    const body = await request.json();
    const input = loginSchema.parse(body);
    const user = await authenticate(input.email, input.password);
    if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await createSession(user.id);
    // Track login count and timestamp (best-effort, never blocks login)
    try {
      await run("UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), user.id]);
      await audit(user.id, "user.login", "user", user.id, { ip });
    } catch {
      // Login tracking failure should not block login
    }
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    return NextResponse.json({ error: "Unable to sign in. Please try again." }, { status: 400 });
  }
}
