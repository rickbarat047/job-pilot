import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertSameOrigin, AuthError } from "./auth";

describe("assertSameOrigin", () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.APP_URL;
  });

  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it("rejects a malformed APP_URL instead of throwing an uncaught exception", () => {
    process.env.APP_URL = "not a url";
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).toThrow(AuthError);
  });

  it("rejects a missing Host header", () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).toThrow(AuthError);
  });

  it("allows an origin matching the configured APP_URL", () => {
    process.env.APP_URL = "https://app.example.com";
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "https://app.example.com", host: "localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });
});