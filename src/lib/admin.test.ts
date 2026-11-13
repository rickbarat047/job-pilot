import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminEmail, adminEmails } from "./admin";

describe("server-only admin allowlist", () => {
  const original = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("is empty and denies everyone when unset", () => {
    expect(adminEmails()).toEqual([]);
    expect(isAdminEmail("admin@example.com")).toBe(false);
  });

  it("denies non-admin users", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("user@example.com")).toBe(false);
  });

  it("allows a configured admin", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("admin@example.com")).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com , second@example.com ";
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
  });
});