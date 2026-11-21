import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveProvider } from "./db";

describe("database provider resolution (fail-closed)", () => {
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = {
      NODE_ENV: (process.env as any).NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
    };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
  });
  afterEach(() => {
    if (saved.NODE_ENV === undefined) delete (process.env as any).NODE_ENV; else (process.env as any).NODE_ENV = saved.NODE_ENV;
    if (saved.DATABASE_URL === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.DATABASE_URL;
    if (saved.POSTGRES_URL === undefined) delete process.env.POSTGRES_URL; else process.env.POSTGRES_URL = saved.POSTGRES_URL;
  });

  it("selects sqlite in local development", () => {
    (process.env as any).NODE_ENV = "development";
    expect(resolveProvider()).toBe("sqlite");
  });

  it("selects postgres when DATABASE_URL is set", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://example";
    expect(resolveProvider()).toBe("postgres");
  });

  it("selects postgres when only POSTGRES_URL is set", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.POSTGRES_URL = "postgres://example";
    expect(resolveProvider()).toBe("postgres");
  });

  it("throws in production when both URLs are missing", () => {
    (process.env as any).NODE_ENV = "production";
    expect(() => resolveProvider()).toThrow(/required in production/);
  });

  it("does not throw in development when both URLs are missing", () => {
    (process.env as any).NODE_ENV = "development";
    expect(() => resolveProvider()).not.toThrow();
    expect(resolveProvider()).toBe("sqlite");
  });
});
