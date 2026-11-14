import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedJob } from "./types";

const mocks = vi.hoisted(() => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(),
}));

vi.mock("./db", () => ({ all: mocks.all, get: mocks.get, run: mocks.run, newId: mocks.newId, nowIso: mocks.nowIso }));
vi.mock("./companies/registry", () => ({ COMPANY_REGISTRY: [], findRegistryCompany: () => undefined }));

import { upsertJob } from "./discovery";

const manualJob = {
  id: "manual_1",
  title: "Controls Engineer",
  companyName: "Example Co",
  companySlug: "example-co",
  description: "Candidate-provided posting details",
  location: "Pune, India",
  country: "India",
  remoteStatus: "onsite",
  employmentType: "full-time",
  skillsRequired: [],
  applicationUrl: "https://example.com/jobs/1",
  applicationMethod: "external",
  source: "manual",
  sourceJobId: "manual_1",
  reliability: 0.7,
  fingerprint: "same-posting",
  raw: {},
} as unknown as NormalizedJob;

describe("manual job ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(undefined);
    mocks.run.mockResolvedValue({ changes: 1 });
    mocks.newId.mockReturnValue("company_1");
    mocks.nowIso.mockReturnValue("2026-11-14T00:00:00.000Z");
  });

  it("requires an owning account for manual job records", async () => {
    await expect(upsertJob(manualJob)).rejects.toThrow("Manual jobs must have an owning account");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("stores manual imports under separate account-owned fingerprints", async () => {
    await upsertJob(manualJob, "usr_one");
    await upsertJob({ ...manualJob, id: "manual_2" }, "usr_two");

    const fingerprints = mocks.get.mock.calls
      .filter(([sql]) => String(sql).includes("WHERE fingerprint = ?"))
      .map(([, params]) => params[0]);
    const inserts = mocks.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO jobs"));
    expect(fingerprints).toHaveLength(2);
    expect(fingerprints[0]).not.toBe(fingerprints[1]);
    expect(inserts.map(([, params]) => params[1])).toEqual(["usr_one", "usr_two"]);
  });
});
