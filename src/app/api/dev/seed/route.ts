import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed";
import { ensureBootstrap } from "@/lib/bootstrap";

export async function POST(request: Request) {
  // The seed endpoint is a development tool and is never available in
  // production, regardless of supplied headers.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await ensureBootstrap();
    const result = await seedDemo();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed." }, { status: 400 });
  }
}