import { NextResponse } from "next/server";
import { createUser, createSession, getSessionUser, destroySession, assertSameOrigin, AuthError } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = clientIp(request);
    const rate = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!rate.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const body = await request.json();
    const input = registerSchema.parse(body);
    const user = await createUser(input);
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to register." }, { status: 400 });
  }
}
