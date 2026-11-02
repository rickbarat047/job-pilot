import { describe, it, expect } from "vitest";
import { generateResumeDocuments } from "./generate";
import { readFile, relativeStoragePath } from "../storage";
import type { ResumeContent } from "../types";

describe("generateResumeDocuments", () => {
  it("creates PDF and DOCX files", async () => {
    const resume: ResumeContent = {
      header: { name: "Aarav", headline: "Engineer", email: "a@example.com", phone: "", location: "Bengaluru" },
      summary: "Summary",
      skills: ["CAD", "Quality Control"],
      experience: [], internships: [], projects: [], education: [], certifications: [], languages: [],
      targetRole: "Quality Engineer", company: "Bosch",
    };
    const docs = await generateResumeDocuments("users/test/docs", resume);
    expect(docs.pdfPath).toMatch(/\.pdf$/);
    const pdf = await readFile(docs.pdfPath);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
