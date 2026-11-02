import { describe, it, expect } from "vitest";
import { parseCvText } from "./parse";

describe("parseCvText", () => {
  it("extracts basic contact and skills", () => {
    const text = `Aarav Sharma
a@example.com
+919876543210
B.Tech Automobile Engineering
Skills: CAD, Quality Control, Python, Communication
Projects: Hybrid Go-Kart`;
    const parsed = parseCvText(text);
    expect(parsed.fullName).toBe("Aarav Sharma");
    expect(parsed.email).toBe("a@example.com");
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.skills).toContain("CAD");
    expect(parsed.skills).toContain("Quality Control");
  });
});
