const APP_URL = process.env.APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";
const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 10 * 60 * 1000);

async function tick() {
  try {
    const response = await fetch(`${APP_URL}/api/cron/tick`, {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET, "content-type": "application/json" },
    });
    const body = await response.text();
    console.log(new Date().toISOString(), "cron tick", response.status, body.slice(0, 300));
  } catch (error) {
    console.error(new Date().toISOString(), "cron tick failed", error instanceof Error ? error.message : error);
  }
}

console.log(`JobPilot scheduler started; ticking every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
