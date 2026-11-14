import { describe, expect, it } from "vitest";
import { discoveryRunStatus } from "./discovery-status";

describe("discovery run status", () => {
  it("distinguishes complete, partial and failed source runs", () => {
    expect(discoveryRunStatus([{ jobs: 0, errors: [] }, { jobs: 5, errors: [] }])).toBe("succeeded");
    expect(discoveryRunStatus([{ jobs: 3, errors: [] }, { jobs: 0, errors: ["timeout"] }])).toBe("partial");
    expect(discoveryRunStatus([{ jobs: 0, errors: ["timeout"] }, { jobs: 0, errors: ["unavailable"] }])).toBe("failed");
    expect(discoveryRunStatus([])).toBe("failed");
  });
});
