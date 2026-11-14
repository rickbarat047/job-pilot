import { describe, expect, it } from "vitest";
import { workerSafeAnswers } from "./worker-tasks";

describe("browser worker answer payload", () => {
  it("omits blank, sensitive and approval-required answers", () => {
    expect(workerSafeAnswers([
      { question: "Safe draft", answer: "Reviewed answer" },
      { question: "Sensitive", answer: "Personal data", sensitive: true },
      { question: "Needs approval", answer: "Unconfirmed claim", requiresApproval: true },
      { question: "Blank", answer: "  " },
    ])).toEqual([{ question: "Safe draft", answer: "Reviewed answer", sensitive: false }]);
  });
});
