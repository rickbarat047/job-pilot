import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureAdapter } from "./fixture";

const original = {
  E2E_FIXTURE_JOBS: process.env.E2E_FIXTURE_JOBS,
  E2E_ALLOW_FIXTURE: process.env.E2E_ALLOW_FIXTURE,
};

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jp-fixture-"));
  writeFileSync(
    join(dir, "jobs.json"),
    JSON.stringify([
      {
        sourceJobId: "e2e-1",
        title: "Software Engineer",
        companyName: "Fixture Technologies",
        descriptionText: "Work with Python, React and SQL. Build reliable web applications in Bengaluru.",
        location: "Bengaluru, India",
        applicationUrl: "http://127.0.0.1:4599/jobs/e2e-1",
      },
    ]),
  );
  process.env.E2E_FIXTURE_JOBS = join(dir, "jobs.json");
  process.env.E2E_ALLOW_FIXTURE = "1";
});

afterEach(() => {
  if (original.E2E_FIXTURE_JOBS === undefined) delete process.env.E2E_FIXTURE_JOBS;
  else process.env.E2E_FIXTURE_JOBS = original.E2E_FIXTURE_JOBS;
  if (original.E2E_ALLOW_FIXTURE === undefined) delete process.env.E2E_ALLOW_FIXTURE;
  else process.env.E2E_ALLOW_FIXTURE = original.E2E_ALLOW_FIXTURE;
  rmSync(dir, { recursive: true, force: true });
});

describe("fixture source adapter", () => {
  it("is discoverable by key but disabled for automatic discovery", () => {
    expect(fixtureAdapter.meta.key).toBe("fixture");
    expect(fixtureAdapter.meta.enabled).toBe(false);
  });

  it("returns deterministic jobs from the configured fixture file", async () => {
    const result = await fixtureAdapter.fetchJobs({ limit: 5 });
    expect(result.errors).toEqual([]);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.id).toBe("fixture:e2e-1");
    expect(result.jobs[0]?.applicationUrl).toContain("127.0.0.1:4599");
  });

  it("fails closed unless explicitly allowed in an isolated environment", async () => {
    delete process.env.E2E_ALLOW_FIXTURE;
    const result = await fixtureAdapter.fetchJobs({ limit: 5 });
    expect(result.jobs).toHaveLength(0);
    expect(result.unavailable).toMatch(/E2E_ALLOW_FIXTURE/);
  });

  it("fails clearly when the fixture file is not configured", async () => {
    delete process.env.E2E_FIXTURE_JOBS;
    const result = await fixtureAdapter.fetchJobs({ limit: 5 });
    expect(result.jobs).toHaveLength(0);
    expect(result.errors.join(" ")).toMatch(/E2E_FIXTURE_JOBS/);
  });
});
