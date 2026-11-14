import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { workerIsOnline } from "@/lib/automation";
import { isAIEnabled } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  let databaseOk = false;
  try {
    await get("SELECT 1 as ok");
    databaseOk = true;
    const aiEnabled = isAIEnabled();
    const workerOnline = await workerIsOnline();
    return NextResponse.json({
      status: aiEnabled && workerOnline ? "ok" : "degraded",
      database: "ok",
      ai: aiEnabled ? "configured" : "fallback",
      worker: workerOnline ? "online" : "offline",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { status: "error", database: "unavailable" },
      { status: 503 },
    );
  } finally {
    logger.info("Health check completed", { databaseOk });
  }
}
