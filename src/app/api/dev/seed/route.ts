import { NextResponse } from "next/server";
import { seedDemo } from "@/lib/seed";
import { ensureBootstrap } from "@/lib/bootstrap";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (process.env.NODE_ENV === "production" && secret !== process.env.CRON_SECRET) {
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

