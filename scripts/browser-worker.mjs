#!/usr/bin/env node
// Playwright browser worker for JobPilot AI.
// Polls the app for queued browser-apply tasks, fills/submits the application
// form in a headless browser, and reports the result back.
//
// ATS adapters (Phase 1) route to per-platform handlers based on the job's
// application URL. Unknown platforms fall back to the generic heuristic.
//
// Required env:
//   APP_URL          e.g. https://jobpilot-ai-sand.vercel.app
//   WORKER_TOKEN     must match the app's WORKER_TOKEN
// Optional:
//   POLL_INTERVAL_MS       default 5000
//   HEARTBEAT_INTERVAL_MS  default 20000
//   HEADLESS               default true
//   BROWSER_TIMEOUT_MS     default 120000
//   ONE_SHOT               if "1", process one task then exit

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const WORKER_TOKEN = process.env.WORKER_TOKEN || "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 20000);
const HEADLESS = process.env.HEADLESS !== "false";
const BROWSER_TIMEOUT_MS = Number(process.env.BROWSER_TIMEOUT_MS || 120000);
const ONE_SHOT = process.env.ONE_SHOT === "1";

if (!WORKER_TOKEN) {
  console.error("WORKER_TOKEN is required.");
  process.exit(1);
}

let playwright;
try {
  playwright = await import("playwright");
} catch (err) {
  console.error("Playwright is not installed. Run: npm install playwright && npx playwright install chromium");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const { chromium } = playwright;
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function api(path, { method = "GET", body, token = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers["x-worker-token"] = WORKER_TOKEN;
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function heartbeat(meta = {}) {
  try {
    await api("/api/automation/worker", { method: "POST", body: { status: "online", meta, token: WORKER_TOKEN } });
  } catch (err) {
    console.error("heartbeat failed", err instanceof Error ? err.message : err);
  }
}

async function downloadDocument(doc, taskId, tmpDir) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = doc.downloadUrl.startsWith("http") ? doc.downloadUrl : `${APP_URL}${doc.downloadUrl}`;
  const res = await fetch(url, { headers: { "x-worker-token": WORKER_TOKEN } });
  if (!res.ok) throw new Error(`document download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(tmpDir, `${doc.id}-${doc.filename || "resume"}`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function fieldMatchers() {
  return [
    { keys: ["full name", "name", "full_name", "applicant name"], value: (c) => c.fullName },
    { keys: ["email", "e-mail", "email address"], value: (c) => c.email },
    { keys: ["phone", "mobile", "telephone", "contact number"], value: (c) => c.phone },
    { keys: ["city", "location city"], value: (c) => c.city },
    { keys: ["state", "province"], value: (c) => c.state },
    { keys: ["country"], value: (c) => c.country },
    { keys: ["linkedin"], value: (c) => c.linkedinUrl },
    { keys: ["github"], value: (c) => c.githubUrl },
    { keys: ["portfolio", "website", "personal site"], value: (c) => c.portfolioUrl },
    { keys: ["headline", "current title", "job title"], value: (c) => c.headline },
    { keys: ["summary", "about", "cover letter", "introduction"], value: (c) => c.summary },
    { keys: ["experience", "years of experience", "total experience"], value: (c) => c.experienceYears },
    { keys: ["degree", "qualification"], value: (c) => c.degree },
    { keys: ["university", "college", "institute"], value: (c) => c.university },
    { keys: ["graduation", "graduation year", "passing year"], value: (c) => c.graduationYear },
    { keys: ["cgpa", "gpa", "percentage"], value: (c) => c.cgpa },
    { keys: ["notice period", "notice"], value: (c) => c.noticePeriod },
    { keys: ["current status", "employment status"], value: (c) => c.currentStatus },
  ];
}

// ---------- ATS detection ----------
function detectAts(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("greenhouse.io") || u.includes("boards.greenhouse")) return "greenhouse";
  if (u.includes("lever.co") || u.includes("jobs.lever")) return "lever";
  if (u.includes("ashbyhq.com") || u.includes("jobs.ashby")) return "ashby";
  if (u.includes("smartrecruiters.com")) return "smartrecruiters";
  if (u.includes("myworkdayjobs.com") || u.includes("workday.com")) return "workday";
  return "generic";
}

async function tmpDir() {
  const os = await import("node:os");
  const path = await import("node:path");
  const fs = await import("node:fs");
  const d = path.join(os.tmpdir(), `jobpilot-worker-${Date.now()}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---------- Generic heuristic filler (fallback) ----------
async function fillGeneric(page, candidate, documents, answers, fieldsFilled) {
  const inputs = await page.locator("input, textarea, select").all();
  for (const input of inputs) {
    try {
      const type = (await input.getAttribute("type")) || "text";
      if (["hidden", "submit", "button", "image", "checkbox", "radio", "file"].includes(type)) continue;
      const name = (await input.getAttribute("name")) || "";
      const placeholder = (await input.getAttribute("placeholder")) || "";
      const id = (await input.getAttribute("id")) || "";
      const ariaLabel = (await input.getAttribute("aria-label")) || "";
      let labelText = "";
      if (id) {
        const lab = page.locator(`label[for="${id}"]`);
        if (await lab.count()) labelText = (await lab.first().innerText()).trim();
      }
      const haystack = [name, placeholder, id, ariaLabel, labelText].join(" ").toLowerCase();
      if (!haystack.trim()) continue;

      let filled = false;
      for (const m of fieldMatchers()) {
        if (m.keys.some((k) => haystack.includes(k))) {
          const val = m.value(candidate);
          if (val === null || val === undefined || val === "") continue;
          const str = String(val);
          if (type.startsWith("select")) {
            try { await input.selectOption({ label: str }); } catch { await input.selectOption(str).catch(() => {}); }
          } else {
            await input.fill(str);
          }
          fieldsFilled.push(name || id || labelText || haystack.trim().slice(0, 40));
          filled = true;
          break;
        }
      }
      if (filled) continue;
      for (const a of answers || []) {
        if (!a.answer) continue;
        const q = String(a.question).toLowerCase();
        if (q && haystack.includes(q.slice(0, 25))) {
          await input.fill(String(a.answer));
          fieldsFilled.push(name || id || labelText || "custom-answer");
          break;
        }
      }
    } catch { /* ignore per-field */ }
  }

  // file uploads
  const resumeDoc = (documents || []).find((d) => /resume|cv/i.test(d.kind || d.filename || "")) || (documents || [])[0];
  if (resumeDoc) {
    let resumePath = null;
    try { resumePath = await downloadDocument(resumeDoc, null, await tmpDir()); } catch (e) {
      console.error("resume download failed", e instanceof Error ? e.message : e);
    }
    if (resumePath) {
      const fileInputs = await page.locator("input[type=file]").all();
      for (const fi of fileInputs) {
        try { await fi.setInputFiles(resumePath); fieldsFilled.push("resume-upload"); } catch { /* ignore */ }
      }
    }
  }
}

// ---------- ATS adapters (best-effort, Phase 1) ----------
async function fillGreenhouse(page, candidate, documents, answers, fieldsFilled) {
  // Greenhouse: single multi-section form; fields have stable name attrs.
  await fillGeneric(page, candidate, documents, answers, fieldsFilled);
  // Greenhouse-specific: EEO dropdowns default to "Decline to self-identify" is fine.
}

async function fillLever(page, candidate, documents, answers, fieldsFilled) {
  await fillGeneric(page, candidate, documents, answers, fieldsFilled);
}

async function fillAshby(page, candidate, documents, answers, fieldsFilled) {
  await fillGeneric(page, candidate, documents, answers, fieldsFilled);
}

async function fillSmartRecruiters(page, candidate, documents, answers, fieldsFilled) {
  await fillGeneric(page, candidate, documents, answers, fieldsFilled);
}

async function fillWorkday(page, candidate, documents, answers, fieldsFilled) {
  // Workday requires account creation + multi-step wizard; generic fill is insufficient.
  await fillGeneric(page, candidate, documents, answers, fieldsFilled);
}

const ADAPTERS = {
  greenhouse: fillGreenhouse,
  lever: fillLever,
  ashby: fillAshby,
  smartrecruiters: fillSmartRecruiters,
  workday: fillWorkday,
  generic: (page, c, d, a, f) => fillGeneric(page, c, d, a, f),
};

async function executeTask(taskPayload) {
  const { task, application, job, candidate, documents, answers, submit } = taskPayload;
  const ats = detectAts(job.applicationUrl);
  console.log("ATS detected:", ats, "for", job.applicationUrl);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(BROWSER_TIMEOUT_MS);
  const fieldsFilled = [];
  let finalUrl = "";
  let screenshotPath = null;
  try {
    if (!job.applicationUrl) throw new Error("Job has no application URL.");
    await page.goto(job.applicationUrl, { waitUntil: "domcontentloaded", timeout: BROWSER_TIMEOUT_MS });
    await page.waitForTimeout(2000);

    const adapter = ADAPTERS[ats] || ADAPTERS.generic;
    await adapter(page, candidate, documents, answers, fieldsFilled);

    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const shotDir = path.join(os.tmpdir(), "jobpilot-shots");
    fs.mkdirSync(shotDir, { recursive: true });
    screenshotPath = path.join(shotDir, `${task.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => { screenshotPath = null; });

    finalUrl = page.url();

    if (submit) {
      const btnSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Apply")',
        'button:has-text("Send")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
      ];
      let clicked = false;
      for (const sel of btnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count()) {
          try {
            await btn.click({ timeout: 5000 });
            clicked = true;
            break;
          } catch { /* try next */ }
        }
      }
      if (!clicked) {
        return { status: "manual_required", message: `Form filled (${ats} adapter) but no submit button found; manual completion required.`, finalUrl, fieldsFilled, screenshotPath };
      }
      await page.waitForTimeout(3000);
      finalUrl = page.url();
      const successText = await page.locator("text=/thank you|application received|submitted|success|we.?ve received/i").count();
      if (successText > 0) {
        return { status: "applied", message: `Application submitted via ${ats} adapter.`, finalUrl, fieldsFilled, screenshotPath };
      }
      const errorText = await page.locator("text=/required|invalid|error|please fill/i").count();
      if (errorText > 0) {
        return { status: "manual_required", message: `${ats} adapter submitted but validation errors detected; manual review required.`, finalUrl, fieldsFilled, screenshotPath };
      }
      return { status: "applied", message: `Submit clicked via ${ats} adapter; assumed success.`, finalUrl, fieldsFilled, screenshotPath };
    }

    return { status: "manual_required", message: `submit=false; form prepared via ${ats} adapter for manual completion.`, finalUrl, fieldsFilled, screenshotPath };
  } catch (err) {
    let shot = null;
    try {
      const os = await import("node:os");
      const path = await import("node:path");
      const fs = await import("node:fs");
      const shotDir = path.join(os.tmpdir(), "jobpilot-shots");
      fs.mkdirSync(shotDir, { recursive: true });
      shot = path.join(shotDir, `${task.id}-error.png`);
      await page.screenshot({ path: shot }).catch(() => { shot = null; });
    } catch { /* ignore */ }
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { screenshotPath: shot, fieldsFilled, finalUrl });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function processOne() {
  let claimed;
  try {
    claimed = await api("/api/automation/worker/tasks/claim", { method: "POST", body: { token: WORKER_TOKEN } });
  } catch (err) {
    console.error("claim failed", err instanceof Error ? err.message : err);
    return false;
  }
  if (!claimed?.task) {
    return false;
  }
  const taskPayload = claimed;
  const taskId = taskPayload.task.id;
  console.log("claimed task", taskId, taskPayload.job?.title, "@", taskPayload.job?.company, "ATS:", detectAts(taskPayload.job?.applicationUrl));

  let result;
  try {
    result = await executeTask(taskPayload);
  } catch (err) {
    result = {
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
      finalUrl: err?.finalUrl || "",
      fieldsFilled: err?.fieldsFilled || [],
      screenshotPath: err?.screenshotPath || null,
    };
  }

  try {
    await api(`/api/automation/worker/tasks/${encodeURIComponent(taskId)}/result`, {
      method: "POST",
      body: {
        token: WORKER_TOKEN,
        status: result.status,
        message: result.message,
        finalUrl: result.finalUrl,
        fieldsFilled: result.fieldsFilled,
        screenshotPath: result.screenshotPath,
      },
    });
    console.log("reported", taskId, result.status);
  } catch (err) {
    console.error("result post failed", err instanceof Error ? err.message : err);
  }
  return true;
}

async function main() {
  console.log(`JobPilot browser worker starting; polling ${APP_URL} every ${POLL_INTERVAL_MS}ms`);
  const hb = setInterval(() => heartbeat({ worker: "playwright", version: "2-ats-adapters", ats: "auto" }), HEARTBEAT_INTERVAL_MS);
  heartbeat({ worker: "playwright", version: "2-ats-adapters", ats: "auto" });

  if (ONE_SHOT) {
    await processOne();
    clearInterval(hb);
    await heartbeat({ worker: "playwright", version: "2-ats-adapters", status: "offline" }).catch(() => {});
    process.exit(0);
  }

  while (!stopping) {
    const hadWork = await processOne();
    if (stopping) break;
    if (!hadWork) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  clearInterval(hb);
  await heartbeat({ worker: "playwright", version: "2-ats-adapters", status: "offline" }).catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});