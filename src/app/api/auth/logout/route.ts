import { NextResponse } from "next/server";
import { destroySession, assertSameOrigin, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  await destroySession();
  return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));
}