import { describe, it, expect, vi } from "vitest";
import { fetchJson, fetchPage, isPrivateHost } from "./http";

describe("isPrivateHost", () => {
  it("blocks localhost and loopback", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
  });

  it("blocks private IPv4 ranges", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("169.254.1.1")).toBe(true);
  });

  it("blocks IPv6 ULA and link-local addresses", () => {
    expect(isPrivateHost("fc00::1")).toBe(true);
    expect(isPrivateHost("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateHost("fe80::1")).toBe(true);
    expect(isPrivateHost("febf::1")).toBe(true);
  });

  it("blocks IPv4-mapped loopback", () => {
    expect(isPrivateHost("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public hosts", () => {
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("2606:4700:4700::1111")).toBe(false);
  });
});

describe("fetchPage redirect handling", () => {
  it("follows a safe redirect", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 302, headers: { location: "https://example.com/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    const result = await fetchPage("https://example.com/start", { fetchImpl });
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  for (const target of [
    "http://localhost/secret",
    "http://127.0.0.1/secret",
    "http://10.0.0.1/secret",
    "http://192.168.1.1/secret",
    "http://[::1]/secret",
    "http://[fc00::1]/secret",
    "http://[fe80::1]/secret",
  ]) {
    it(`never requests redirect target ${target}`, async () => {
      const fetchImpl = vi.fn().mockResolvedValueOnce(
        new Response("", { status: 302, headers: { location: target } }),
      );
      await expect(fetchPage("https://example.com/start", { fetchImpl })).rejects.toThrow();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  }

  it("fails on missing redirect Location", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("", { status: 302 }));
    await expect(fetchPage("https://example.com/start", { fetchImpl })).rejects.toThrow(/Location/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails when redirect hops exceed the limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("", { status: 302, headers: { location: "https://example.com/next" } }),
    );
    await expect(fetchPage("https://example.com/start", { fetchImpl })).rejects.toThrow(/Too many redirects/);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe("fetchJson redirect handling", () => {
  it("does not follow an unsafe redirect before checking", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response("", { status: 302, headers: { location: "http://127.0.0.1/secret" } }),
    );
    await expect(fetchJson("https://example.com/start", { fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});