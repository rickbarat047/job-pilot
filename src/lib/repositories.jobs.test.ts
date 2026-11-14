import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  all: vi.fn(async (_sql: string, _params?: unknown[]) => []),
  get: vi.fn(async (_sql: string, _params?: unknown[]) => ({ c: 0 })),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, all: mocks.all, get: mocks.get };
});

import { getJobsForUser } from "./repositories";

describe("getJobsForUser search filters", () => {
  beforeEach(() => {
    mocks.all.mockClear();
    mocks.get.mockClear();
  });

  it("searches job text and location case-insensitively while treating LIKE wildcards literally", async () => {
    await getJobsForUser("candidate-1", { query: "C%_\\++", location: "Bengaluru_" });

    const [sql, params] = mocks.all.mock.calls[0];
    expect(sql).toContain("LOWER(j.title) LIKE ? ESCAPE '\\'");
    expect(sql).toContain("LOWER(j.company_name) LIKE ? ESCAPE '\\'");
    expect(sql).toContain("LOWER(j.description) LIKE ? ESCAPE '\\'");
    expect(sql).toContain("LOWER(j.city) LIKE ? ESCAPE '\\'");
    expect(sql).toContain("LOWER(j.location) LIKE ? ESCAPE '\\'");
    expect(params).toEqual([
      "candidate-1",
      "%c\\%\\_\\\\++%", "%c\\%\\_\\\\++%", "%c\\%\\_\\\\++%",
      "%bengaluru\\_%", "%bengaluru\\_%",
      24, 0,
    ]);
  });
});
