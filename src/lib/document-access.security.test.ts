import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  readFile: vi.fn(),
  absoluteStoragePath: vi.fn((relative: string) => `/storage/${relative}`),
}));

vi.mock("@/lib/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/lib/storage", () => ({
  readFile: mocks.readFile,
  absoluteStoragePath: mocks.absoluteStoragePath,
}));

import { GET } from "../app/api/documents/[...path]/route";

function context(segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

function request() {
  return new Request("http://localhost/api/documents/users/usr_1/cv/resume.pdf");
}

describe("document download response hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "usr_1" });
    mocks.readFile.mockResolvedValue(Buffer.from("cv-bytes"));
    mocks.absoluteStoragePath.mockImplementation((relative: string) => `/storage/${relative}`);
  });

  it("sends private, no-store on a successful, ownership-checked download", async () => {
    const res = await GET(request(), context(["users", "usr_1", "cv", "resume.pdf"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain('filename="resume.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("cv-bytes");
  });

  it("still refuses another user's path without touching storage", async () => {
    const res = await GET(request(), context(["users", "usr_999", "cv", "resume.pdf"]));
    expect(res.status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("still refuses path traversal segments", async () => {
    const res = await GET(request(), context(["users", "usr_1", "..", "usr_999", "resume.pdf"]));
    expect(res.status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns a generic error instead of the exception message", async () => {
    mocks.readFile.mockRejectedValueOnce(new Error("ENOENT secret-root /srv/private/resume.pdf"));
    const res = await GET(request(), context(["users", "usr_1", "cv", "resume.pdf"]));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unable to read document.");
    expect(JSON.stringify(body)).not.toContain("secret-root");
  });
});
