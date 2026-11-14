import { describe, expect, it } from "vitest";
import { eligibleRemoteLocation } from "./remote-boards";

describe("remote job location eligibility", () => {
  it("accepts jobs explicitly open to India or candidates worldwide", () => {
    expect(eligibleRemoteLocation("India" )).toBe(true);
    expect(eligibleRemoteLocation("Remote — India and Singapore")).toBe(true);
    expect(eligibleRemoteLocation("Worldwide" )).toBe(true);
    expect(eligibleRemoteLocation("Anywhere in the world")).toBe(true);
  });

  it("fails closed when location eligibility is missing or excludes India", () => {
    expect(eligibleRemoteLocation("")).toBe(false);
    expect(eligibleRemoteLocation("Remote")).toBe(false);
    expect(eligibleRemoteLocation("United States, Canada" )).toBe(false);
  });
});
