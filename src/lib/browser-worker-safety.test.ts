import { describe, expect, it } from "vitest";
import { hasNewSubmissionConfirmation, isFinalApplicationSubmitLabel } from "../../scripts/browser-worker-lib.mjs";

describe("browser worker submission safety", () => {
  it.each(["Apply", "Apply now", "Submit", "Submit application", "Send application"]) (
    "allows an explicit final action: %s",
    (label) => expect(isFinalApplicationSubmitLabel(label)).toBe(true),
  );

  it.each(["Continue", "Next", "Save and continue", "Review application", "Preview", "Send message"]) (
    "does not treat %s as final submission",
    (label) => expect(isFinalApplicationSubmitLabel(label)).toBe(false),
  );

  it("accepts a new employer confirmation after clicking submit", () => {
    expect(hasNewSubmissionConfirmation("Application form", "Thank you for applying. We have received your application.")).toBe(true);
  });

  it("does not mistake a pre-existing success message for a new submission", () => {
    const text = "Thank you for applying. We have received your application.";
    expect(hasNewSubmissionConfirmation(text, text)).toBe(false);
  });

  it("requires a confirmation phrase", () => {
    expect(hasNewSubmissionConfirmation("Application form", "Something changed after submit.")).toBe(false);
  });
});
