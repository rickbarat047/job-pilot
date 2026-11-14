import { describe, expect, it } from "vitest";
import { shouldNotifyStrongMatch } from "./discovery";

describe("strong job match notifications", () => {
  it("notifies when a qualified job first reaches the strong-match threshold", () => {
    expect(shouldNotifyStrongMatch({ overallScore: 75, qualified: true }, null)).toBe(true);
  });

  it("does not repeat a notification for a match that was already strong", () => {
    expect(shouldNotifyStrongMatch({ overallScore: 91, qualified: true }, 82)).toBe(false);
  });

  it("notifies if a previously weaker match becomes strong", () => {
    expect(shouldNotifyStrongMatch({ overallScore: 80, qualified: true }, 74)).toBe(true);
  });

  it("does not label a disqualified result as a strong match", () => {
    expect(shouldNotifyStrongMatch({ overallScore: 95, qualified: false }, null)).toBe(false);
  });
});
