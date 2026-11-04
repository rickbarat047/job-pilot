import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { workerIsOnline } from "@/lib/automation";
import { isAIEnabled } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function GET() {
  try {
    await get("SELECT 1 as ok");
    return NextResponse.json({
      status: "ok",
      database: "ok",
      ai: isAIEnabled() ? "configured" : "fallback",
      worker: (await workerIsOnline()) ? "online" : "offline",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  }
}
