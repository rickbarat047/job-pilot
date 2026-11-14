import { describe, expect, it } from "vitest";
import { discoveryRunStatus } from "./discovery-status";

describe("discovery run status", () => {
  it("distinguishes complete, partial and failed source runs", () => {
    expect(discoveryRunStatus([{ jobs: 0, errors: [] }, { jobs: 5, errors: [] }])).toBe("succeeded");
    expect(discoveryRunStatus([{ jobs: 3, errors: [] }, { jobs: 0, errors: ["timeout"] }])).toBe("partial");
    expect(discoveryRunStatus([{ jobs: 0, errors: ["timeout"] }, { jobs: 0, errors: ["unavailable"] }])).toBe("failed");
    expect(discoveryRunStatus([])).toBe("failed");
  });

  it("does not report an explicitly selected unsupported source as successful", () => {
    expect(discoveryRunStatus([{ jobs: 0, errors: [], unavailable: "No public search API" }])).toBe("failed");
  });

  it("reports partial when supported sources ran but a selected source was unavailable", () => {
    expect(discoveryRunStatus([
      { jobs: 4, errors: [] },
      { jobs: 0, errors: [], unavailable: "No public search API" },
    ])).toBe("partial");
  });

  it("does not hide total failure of supported sources behind an unavailable source", () => {
    expect(discoveryRunStatus([
      { jobs: 0, errors: ["timeout"] },
      { jobs: 0, errors: [], unavailable: "No public search API" },
    ])).toBe("failed");
  });
});
