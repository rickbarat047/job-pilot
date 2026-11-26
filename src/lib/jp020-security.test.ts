import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const workerSource = readFileSync(join(repoRoot, "scripts/browser-worker.mjs"), "utf8");
const healthWorkflow = readFileSync(join(repoRoot, ".github/workflows/health-check.yml"), "utf8");
const browserWorkflow = readFileSync(join(repoRoot, ".github/workflows/browser-worker.yml"), "utf8");

describe("JP-020 worker client credential hygiene", () => {
  it("never serializes the worker token into a JSON body", () => {
    expect(workerSource).not.toMatch(/token:\s*WORKER_TOKEN/);
  });

  it("sends the worker token through the x-worker-token header", () => {
    expect(workerSource).toContain("x-worker-token");
  });
});

describe("JP-020 health check gate", () => {
  it("parses the health JSON and fails on degraded or error", () => {
    expect(healthWorkflow).toMatch(/status/);
    expect(healthWorkflow).toMatch(/degraded/);
    expect(healthWorkflow).toMatch(/error/);
  });

  it("does not treat HTTP 200 alone as success", () => {
    expect(healthWorkflow).not.toMatch(/if\s*\[\s*"\$status"\s*!=\s*"200"\s*\]\s*;\s*then\s*exit\s*1\s*;\s*fi/);
  });
});

describe("JP-020 browser worker CI compatibility", () => {
  it("installs Playwright from the committed lockfile, not a hardcoded old version", () => {
    expect(browserWorkflow).not.toMatch(/npm\s+install\s+playwright@/);
    expect(browserWorkflow).toMatch(/npm\s+ci/);
  });

  it("keys the browser cache on the lockfile", () => {
    expect(browserWorkflow).toMatch(/hashFiles\(['"]package-lock\.json['"]\)/);
  });
});
