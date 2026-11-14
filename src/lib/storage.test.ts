import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { deleteUserFiles } from "./storage";

describe("deleteUserFiles", () => {
  const originalStorageDir = process.env.STORAGE_DIR;
  let root: string | undefined;

  afterEach(() => {
    if (originalStorageDir === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = originalStorageDir;
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
    vi.unstubAllEnvs();
  });

  it("removes all local files for one account and preserves other accounts", async () => {
    root = mkdtempSync(path.join(os.tmpdir(), "jobpilot-storage-"));
    process.env.STORAGE_DIR = root;
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const accountFile = path.join(root, "users", "usr_one", "cv", "resume.pdf");
    const otherFile = path.join(root, "users", "usr_two", "cv", "resume.pdf");
    mkdirSync(path.dirname(accountFile), { recursive: true });
    mkdirSync(path.dirname(otherFile), { recursive: true });
    writeFileSync(accountFile, "private");
    writeFileSync(otherFile, "keep");

    await deleteUserFiles("usr_one");

    expect(existsSync(accountFile)).toBe(false);
    expect(existsSync(otherFile)).toBe(true);
  });

  it("rejects IDs that could escape the user storage directory", async () => {
    await expect(deleteUserFiles("../other")).rejects.toThrow("Invalid user storage key");
  });
});
