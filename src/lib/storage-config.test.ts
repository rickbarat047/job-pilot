import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveStorageProvider } from "./storage";

describe("storage provider resolution (fail-closed)", () => {
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = {
      NODE_ENV: (process.env as any).NODE_ENV,
      SUPABASE_URL: process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    if (saved.NODE_ENV === undefined) delete (process.env as any).NODE_ENV; else (process.env as any).NODE_ENV = saved.NODE_ENV;
    if (saved.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = saved.SUPABASE_URL;
    if (saved.NEXT_PUBLIC_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.NEXT_PUBLIC_SUPABASE_URL;
    if (saved.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("selects supabase when configured", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";
    expect(resolveStorageProvider()).toBe("supabase");
  });

  it("falls back to local in development when unconfigured", () => {
    (process.env as any).NODE_ENV = "development";
    expect(resolveStorageProvider()).toBe("local");
  });

  it("throws in production when unconfigured", () => {
    (process.env as any).NODE_ENV = "production";
    expect(() => resolveStorageProvider()).toThrow(/required in production/);
  });

  it("throws in production when only URL is set", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    expect(() => resolveStorageProvider()).toThrow(/required in production/);
  });
});
