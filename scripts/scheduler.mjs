const APP_URL = process.env.APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";
const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 10 * 60 * 1000);
const RUNS = Number(process.env.SCHEDULER_RUNS || 0);

let ticks = 0;
let stopping = false;

async function tickOnce() {
  let hasMore = true;
  let safety = 0;
  while (hasMore && safety < 20) {
    safety += 1;
    try {
      const response = await fetch(`${APP_URL}/api/cron/tick`, {
        method: "POST",
        headers: { "x-cron-secret": CRON_SECRET, "content-type": "application/json" },
      });
      const body = await response.text();
      console.log(new Date().toISOString(), "cron tick", response.status, body.slice(0, 200));
      try {
        const json = JSON.parse(body);
        hasMore = Boolean(json.hasMore);
      } catch {
        hasMore = false;
      }
    } catch (error) {
      console.error(new Date().toISOString(), "cron tick failed", error instanceof Error ? error.message : error);
      hasMore = false;
    }
  }
}

async function tick() {
  await tickOnce();
  ticks += 1;
  if (RUNS > 0 && ticks >= RUNS) {
    console.log(`scheduler reached ${ticks} tick(s); exiting`);
    process.exit(0);
  }
}

console.log(`JobPilot scheduler started; ticking every ${INTERVAL_MS}ms${RUNS > 0 ? `, ${RUNS} run(s) then exit` : ""}`);
process.on("SIGINT", () => { console.log("scheduler stopping"); stopping = true; });
process.on("SIGTERM", () => process.exit(0));
tick();
const timer = setInterval(() => {
  if (stopping) { clearInterval(timer); process.exit(0); }
  tick();
}, INTERVAL_MS);