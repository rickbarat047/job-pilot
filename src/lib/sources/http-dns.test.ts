import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns", () => ({
  default: { promises: { lookup: vi.fn() } },
  promises: { lookup: vi.fn() },
}));

import { fetchJson, fetchPage, pinnedLookup, resolveSafeAddresses } from "./http";
import dns from "node:dns";

describe("resolveSafeAddresses", () => {
  beforeEach(() => {
    vi.mocked(dns.promises.lookup).mockReset();
  });

  it("rejects when DNS returns a private IPv4 address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as any);
    await expect(resolveSafeAddresses("example.com")).rejects.toThrow(/private|reserved/i);
  });

  it("rejects when DNS returns a private IPv6 address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValue([{ address: "fc00::1", family: 6 }] as any);
    await expect(resolveSafeAddresses("example.com")).rejects.toThrow(/private|reserved/i);
  });

  it("returns public addresses", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
    await expect(resolveSafeAddresses("example.com")).resolves.toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("fetchJson rejects before network when DNS returns a private address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValue([{ address: "10.0.0.1", family: 4 }] as any);
    await expect(fetchJson("https://example.com/data")).rejects.toThrow(/private|reserved/i);
  });

  it("fetchPage rejects before network when DNS returns a private address", async () => {
    vi.mocked(dns.promises.lookup).mockResolvedValue([{ address: "fd12:3456:789a::1", family: 6 }] as any);
    await expect(fetchPage("https://example.com/page")).rejects.toThrow(/private|reserved/i);
  });
});

describe("pinnedLookup", () => {
  it("returns an address array when options.all is true", () => {
    const cb = vi.fn();
    pinnedLookup("93.184.216.34", 4)("example.com", { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });

  it("returns address and family when options.all is false", () => {
    const cb = vi.fn();
    pinnedLookup("93.184.216.34", 4)("example.com", {}, cb);
    expect(cb).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
});