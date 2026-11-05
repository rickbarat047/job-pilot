import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { get, run, nowIso, newId } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push not configured." }, { status: 503 });
  return NextResponse.json({ publicKey });
}