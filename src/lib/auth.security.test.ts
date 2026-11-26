import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  newId: vi.fn(() => "id-new"),
  nowIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
  parseJson: vi.fn(),
  toJson: vi.fn(),
  transaction: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  validatePasswordStrength: vi.fn(() => null),
  cookies: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./password", () => mocks);
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { authenticate, createSession } from "./auth";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "jobpilot_session";
const STORED_HASH = `scrypt${"$"}${"ab".repeat(16)}${"$"}${"cd".repeat(64)}`;
const DUMMY_HASH_PATTERN = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cookieJar(existingToken?: string) {
  const set = vi.fn();
  mocks.cookies.mockResolvedValue({
    get: () => (existingToken === undefined ? undefined : { name: COOKIE_NAME, value: existingToken }),
    set,
  });
  return set;
}

describe("auth hardening", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(undefined);
    mocks.newId.mockReturnValue("id-new");
    mocks.nowIso.mockReturnValue("2026-01-01T00:00:00.000Z");
    mocks.validatePasswordStrength.mockReturnValue(null);
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("performs a dummy scrypt verification for an unknown user", async () => {
    mocks.get.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);

    expect(await authenticate("nobody@example.com", "a-password")).toBeNull();
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    const [password, hash] = mocks.verifyPassword.mock.calls[0] as [string, string];
    expect(password).toBe("a-password");
    expect(hash).toMatch(DUMMY_HASH_PATTERN);
  });

  it("performs the same dummy verification for a soft-deleted user", async () => {
    mocks.get.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);
    expect(await authenticate("unknown@example.com", "a-password")).toBeNull();
    const unknownHash = mocks.verifyPassword.mock.calls[0][1];

    mocks.verifyPassword.mockClear();
    mocks.get.mockResolvedValue({
      id: "usr-1", email: "gone@example.com", name: "Gone",
      password_hash: STORED_HASH, created_at: "2026-01-01T00:00:00.000Z", deleted_at: "2026-02-01T00:00:00.000Z",
    });
    expect(await authenticate("gone@example.com", "a-password")).toBeNull();
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPassword.mock.calls[0][1]).toBe(unknownHash);
    expect(mocks.verifyPassword.mock.calls[0][1]).not.toBe(STORED_HASH);
  });

  it("still verifies the stored hash for an active user", async () => {
    mocks.get.mockResolvedValue({
      id: "usr-1", email: "live@example.com", name: "Live",
      password_hash: STORED_HASH, created_at: "2026-01-01T00:00:00.000Z", deleted_at: null,
    });
    mocks.verifyPassword.mockResolvedValue(true);

    expect(await authenticate("live@example.com", "a-password")).toEqual({
      id: "usr-1", email: "live@example.com", name: "Live", createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("a-password", STORED_HASH);
  });

  it("deletes an existing session before rotating the cookie on login", async () => {
    const set = cookieJar("old-token");

    await createSession("usr-1");

    const calls = mocks.run.mock.calls as [string, unknown[]][];
    const deleteIndex = calls.findIndex(([sql]) => sql.startsWith("DELETE FROM sessions WHERE token_hash = ?"));
    const insertIndex = calls.findIndex(([sql]) => sql.startsWith("INSERT INTO sessions"));
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(deleteIndex);
    expect(calls[deleteIndex][1]).toEqual([sha256("old-token")]);

    expect(set).toHaveBeenCalledTimes(1);
    const [name, token, options] = set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe(COOKIE_NAME);
    expect(token).not.toBe("old-token");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(calls[insertIndex][1][2]).toBe(sha256(token));
    expect(calls[insertIndex][1][1]).toBe("usr-1");
  });

  it("creates a session without a delete when no cookie is present", async () => {
    const set = cookieJar();

    await createSession("usr-1");

    const calls = mocks.run.mock.calls as [string, unknown[]][];
    expect(calls.some(([sql]) => sql.startsWith("DELETE FROM sessions WHERE token_hash = ?"))).toBe(false);
    expect(calls.some(([sql]) => sql.startsWith("INSERT INTO sessions"))).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("keeps the secure cookie flag in production", async () => {
    (process.env as any).NODE_ENV = "production";
    const set = cookieJar("old-token");

    await createSession("usr-1");

    expect(set.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });
});
