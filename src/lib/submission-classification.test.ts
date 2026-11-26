import { describe, it, expect } from "vitest";
import { classifySubmissionResult } from "../../scripts/browser-worker-lib.mjs";

const base = { successCount: 0, errorCount: 0, captchaDetected: false, timeout: false, clicked: false, finalUrlChanged: false };

describe("classifySubmissionResult", () => {
  it("reports applied only for explicit employer confirmation", () => {
    const r = classifySubmissionResult({ ...base, successCount: 1, clicked: true });
    expect(r.status).toBe("applied");
    expect(r.reason).toBe("explicit-confirmation");
  });

  it("reports manual_required for form validation errors", () => {
    const r = classifySubmissionResult({ ...base, errorCount: 1, clicked: true });
    expect(r.status).toBe("manual_required");
    expect(r.reason).toBe("form-validation-error");
  });

  it("reports manual_required for CAPTCHA or unsupported forms", () => {
    expect(classifySubmissionResult({ ...base, captchaDetected: true, clicked: true }).reason).toBe("captcha");
  });

  it("never infers success from the absence of an error", () => {
    const r = classifySubmissionResult({ ...base, clicked: true });
    expect(r.status).toBe("manual_required");
    expect(r.reason).toBe("no-confirmation");
  });

  it("distinguishes a timeout after submit from an unsubmitted form", () => {
    expect(classifySubmissionResult({ ...base, clicked: true, timeout: true, finalUrlChanged: true }).reason).toBe("timeout-after-submit");
    expect(classifySubmissionResult({ ...base }).reason).toBe("unsubmitted");
  });

  it("prefers explicit confirmation over errors and timeouts", () => {
    expect(classifySubmissionResult({ ...base, successCount: 1, errorCount: 1, timeout: true }).status).toBe("applied");
  });
});
