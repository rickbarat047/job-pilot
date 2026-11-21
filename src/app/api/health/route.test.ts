import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("health route", () => {
  it("reports the real status, with the database probed separately", async () => {
    // JP-003: the endpoint must no longer claim "ok" when a component is
    // degraded (e.g. the scheduled browser worker being offline).
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.database).toBe("ok");
    expect(typeof body.worker).toBe("string");
    expect(["online", "offline", "unavailable"]).toContain(body.worker);
  });
});
