import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getApplicationDetail: vi.fn(),
  getPermissionsForUser: vi.fn(),
  assertPermission: vi.fn(),
  affectedRows: vi.fn(),
  newId: vi.fn(),
  nowIso: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
  sendApplicationEmail: vi.fn(),
  workerIsOnline: vi.fn(),
  checkRateLimit: vi.fn(),
  clientIp: vi.fn(),
  supportedAtsForUrl: vi.fn(),
  isActiveForAutomatedApplication: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/repositories", () => ({ getApplicationDetail: mocks.getApplicationDetail, getPermissionsForUser: mocks.getPermissionsForUser }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db", () => ({ affectedRows: mocks.affectedRows, newId: mocks.newId, nowIso: mocks.nowIso, run: mocks.run, transaction: mocks.transaction }));
vi.mock("@/lib/email", () => ({ sendApplicationEmail: mocks.sendApplicationEmail }));
vi.mock("@/lib/automation", () => ({ workerIsOnline: mocks.workerIsOnline }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit, clientIp: mocks.clientIp }));
vi.mock("@/lib/ats-safety", () => ({ supportedAtsForUrl: mocks.supportedAtsForUrl }));
vi.mock("@/lib/job-verification", () => ({ isActiveForAutomatedApplication: mocks.isActiveForAutomatedApplication }));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "app_1" }) };
const database = { run: vi.fn() };

function request(body: unknown) {
  return new Request("https://jobpilot.test/api/applications/app_1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("browser application submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user_1" });
    mocks.getApplicationDetail.mockResolvedValue({
      application: { id: "app_1", state: "Approved", jobId: "job_1", method: "external" },
      job: { method: "external", status: "active", applicationUrl: "https://boards.greenhouse.io/example/jobs/123" },
      documents: [],
      questions: [],
    });
    mocks.getPermissionsForUser.mockResolvedValue({ demoMode: false });
    mocks.assertPermission.mockImplementation(() => undefined);
    mocks.affectedRows.mockReturnValue(1);
    mocks.newId.mockImplementation((prefix: string) => `${prefix}_test`);
    mocks.nowIso.mockReturnValue("2026-11-14T00:00:00.000Z");
    mocks.run.mockResolvedValue({ changes: 1 });
    database.run.mockResolvedValue({ changes: 1 });
    mocks.transaction.mockImplementation(async (callback: (db: typeof database) => Promise<unknown>) => callback(database));
    mocks.workerIsOnline.mockResolvedValue(true);
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.clientIp.mockReturnValue("127.0.0.1");
    mocks.supportedAtsForUrl.mockReturnValue({ provider: "greenhouse" });
    mocks.isActiveForAutomatedApplication.mockReturnValue(true);
  });

  it("updates state, creates the worker task and timeline event atomically", async () => {
    const response = await POST(request({ method: "browser" }), context);
    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(database.run).toHaveBeenCalledTimes(3);
    expect(database.run.mock.calls[0][0]).toContain("state='Approved'");
    expect(database.run.mock.calls[1][0]).toContain("INSERT INTO automation_tasks");
    expect(database.run.mock.calls[2][0]).toContain("application.browser_queued");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("returns a conflict and creates no task if another request already advanced the application", async () => {
    mocks.affectedRows.mockReturnValue(0);
    const response = await POST(request({ method: "browser" }), context);
    expect(response.status).toBe(409);
    expect(database.run).toHaveBeenCalledOnce();
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
