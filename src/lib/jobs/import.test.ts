import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  resolveSafeAddresses: vi.fn(),
}));

vi.mock("../sources/http", () => mocks);

import { importManualJob } from "./import";

describe("importManualJob", () => {
  beforeEach(() => {
    mocks.fetchPage.mockReset();
    mocks.resolveSafeAddresses.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it.each([
    ["insecure URL", "http://example.com/job"],
    ["embedded credentials", "https://user:pass@example.com/job"],
    ["unsupported scheme", "file:///etc/passwd"],
    ["oversized URL", `https://example.com/${"a".repeat(2050)}`],
  ])("rejects %s", async (_label, url) => {
    await expect(importManualJob({ url, title: "Engineer", description: "Role details" })).rejects.toThrow();
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });

  it("rejects a private host before importing even when details are supplied", async () => {
    mocks.resolveSafeAddresses.mockRejectedValue(new Error("Private or local network hosts are not allowed."));
    await expect(importManualJob({ url: "https://127.0.0.1/job", title: "Engineer", description: "Role details" })).rejects.toThrow(/Private or local/);
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });

  it("imports supplied details without fetching a second time", async () => {
    const job = await importManualJob({
      url: "https://example.com/careers/role",
      title: "Product Analyst",
      companyName: "Example Co",
      location: "Bengaluru",
      description: "Analyze product usage and build reports.",
    });
    expect(job).toMatchObject({ title: "Product Analyst", companyName: "Example Co", applicationUrl: "https://example.com/careers/role" });
    expect(mocks.resolveSafeAddresses).toHaveBeenCalledWith("example.com");
    expect(mocks.fetchPage).not.toHaveBeenCalled();
  });

  it("enforces field size bounds", async () => {
    await expect(importManualJob({ url: "https://example.com/job", title: "x".repeat(201), description: "Role details" })).rejects.toThrow(/Role title/);
  });
});
