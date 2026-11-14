import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("health route", () => {
  it("returns an ok status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.database).toBe("ok");
    expect(body.ai).toMatch(/^(configured|fallback)$/);
    expect(body.worker).toMatch(/^(online|offline)$/);
    expect(body.status).toBe(body.ai === "configured" && body.worker === "online" ? "ok" : "degraded");
  });
});
