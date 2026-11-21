import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { workerIsOnline } from "@/lib/automation";
import { isAIEnabled } from "@/lib/ai/provider";
import { resolveStorageProvider } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export type HealthStatus = "ok" | "degraded" | "error";
type ComponentStatus = "ok" | "unavailable";

export interface HealthReport {
  status: HealthStatus;
  frontend: ComponentStatus;
  database: ComponentStatus;
  authentication: ComponentStatus;
  storage: ComponentStatus;
  ai: "configured" | "fallback";
  worker: "online" | "offline" | "unavailable";
  email: "configured" | "unconfigured";
  timestamp: string;
}

export type HealthComponents = Omit<HealthReport, "status" | "timestamp">;

/**
 * Derive the overall status from the individual probes.
 * A dead database is a hard failure; a degraded worker/AI/storage/auth is
 * reported honestly but does not take the endpoint offline for HTTP-based
 * uptime checks (which treat any 200 as "up").
 */
export function overallStatus(components: HealthComponents): HealthStatus {
  if (components.database === "unavailable") return "error";
  if (
    components.authentication === "unavailable" ||
    components.storage === "unavailable" ||
    components.ai === "fallback" ||
    components.worker !== "online" ||
    components.email === "unconfigured"
  ) {
    return "degraded";
  }
  return "ok";
}

async function probe(fn: () => unknown | Promise<unknown>): Promise<ComponentStatus> {
  try {
    await fn();
    return "ok";
  } catch {
    return "unavailable";
  }
}

function emailIsConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER),
  );
}

export async function GET() {
  const database = await probe(() => get("SELECT 1 AS ok"));
  const authentication = database === "ok"
    ? await probe(() => get("SELECT token_hash FROM sessions LIMIT 0"))
    : "unavailable";
  const storage = await probe(() => resolveStorageProvider());

  let worker: HealthReport["worker"];
  try {
    worker = (await workerIsOnline()) ? "online" : "offline";
  } catch {
    worker = "unavailable";
  }

  const components: HealthComponents = {
    frontend: "ok",
    database,
    authentication,
    storage,
    ai: isAIEnabled() ? "configured" : "fallback",
    worker,
    email: emailIsConfigured() ? "configured" : "unconfigured",
  };

  const status = overallStatus(components);
  const report: HealthReport = { status, ...components, timestamp: new Date().toISOString() };

  if (status === "error") {
    logger.error("Health check failed", { status, database, authentication, storage, worker });
  } else {
    logger.info("Health check completed", { status, database, authentication, storage, ai: components.ai, worker });
  }

  return NextResponse.json(report, { status: status === "error" ? 503 : 200 });
}
