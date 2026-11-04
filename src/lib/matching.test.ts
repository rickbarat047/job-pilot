import { describe, it, expect } from "vitest";
import { matchJob } from "./matching";
import type { CandidateProfile, CandidatePreferences, NormalizedJob } from "./types";

const profile: CandidateProfile = {
  userId: "u1", fullName: "Aarav Sharma", email: "a@example.com", phone: "", city: "Bengaluru", state: "Karnataka", country: "India",
  linkedinUrl: "", githubUrl: "", portfolioUrl: "", headline: "", summary: "B.Tech Automobile Engineering graduate", degree: "B.Tech Automobile Engineering",
  university: "VTU", graduationYear: "2025", cgpa: "7.8", experienceYears: 0.5, currentStatus: "Fresher", noticePeriod: "Immediate", languages: ["English"],
  skills: [{ name: "CAD" }, { name: "Quality Control" }, { name: "Communication" }, { name: "Problem Solving" }],
  experience: [], internships: [], projects: [], certifications: [], education: [], rawCvText: "",
};

const prefs: CandidatePreferences = {
  targetRoles: ["Quality Engineer"], experienceLevels: ["Fresher"], employmentTypes: ["Full-time"], workModes: ["On-site"],
  preferredLocations: ["Bengaluru"], allIndia: true, remoteIndia: true, internationalRemote: false, minSalaryLpa: 4,
  salaryFlexible: true, unpaidInternship: false, paidInternship: true, industries: ["Automotive", "Manufacturing"],
  flexibility: { anyIndustry: true, anyRole: true, willingToLearn: true, willingToRelocate: true, willingToRemote: true, entryLevel: true, startups: true, nonCore: true },
  matchWeights: { skills: 30, education: 15, experience: 15, career: 15, location: 10, salary: 5, flexibility: 5, freshness: 5 },
};

const baseJob = (overrides: Partial<NormalizedJob>): NormalizedJob => ({
  id: "src:1", source: "test", sourceJobId: "1", title: "Quality Engineer", companyName: "Bosch Group", companySlug: "bosch-group",
  description: "Quality Engineer role requiring CAD, quality control, ISO standards and 0-2 years experience. Location Bengaluru.",
  location: "Bengaluru, India", city: "Bengaluru", country: "India", remoteStatus: "onsite", employmentType: "full-time",
  skillsRequired: ["CAD", "Quality Control", "ISO Standards"], salaryMin: 5, salaryMax: 7, salaryCurrency: "INR", salaryText: "5-7 LPA",
  applicationUrl: "https://example.com", applicationMethod: "external", postedAt: new Date().toISOString(),
  lastVerifiedAt: new Date().toISOString(), status: "active", reliability: 0.9, fingerprint: "fp", ...overrides,
});

describe("matchJob", () => {
  it("scores a suitable fresher role highly", () => {
    const result = matchJob(profile, prefs, baseJob({}));
    expect(result.overallScore).toBeGreaterThanOrEqual(60);
    expect(result.qualified).toBe(true);
    expect(result.strengths).toContain("CAD");
  });

  it("disqualifies a role requiring a professional license", () => {
    const result = matchJob(profile, prefs, baseJob({ title: "Chartered Accountant", description: "Requires CA qualification and 3 years experience.", educationRequirements: "CA / ICWA", skillsRequired: ["Accounting"] }));
    expect(result.qualified).toBe(false);
    expect(result.disqualifiers.join(" ")).toMatch(/professional qualification|years/i);
  });

  it("does not reject a job solely because the degree title differs", () => {
    const result = matchJob(profile, prefs, baseJob({ title: "Business Analyst", description: "Business Analyst role for any graduate with Excel and communication.", skillsRequired: ["Excel", "Communication"], educationRequirements: "Any graduate" }));
    expect(result.overallScore).toBeGreaterThan(0);
  });

  it("caps an unrelated role with zero skill overlap even when location and salary fit", () => {
    const result = matchJob(profile, prefs, baseJob({
      title: "Freelance Writer",
      description: "Write and edit articles. Requires SEO copywriting, content strategy and editorial research.",
      skillsRequired: ["SEO Copywriting", "Content Strategy", "Editorial Research"],
      location: "Worldwide",
      city: "",
      country: "Worldwide",
      remoteStatus: "remote",
      salaryMin: 50,
      salaryMax: 75,
      salaryCurrency: "USD",
      salaryText: "$50-$75 /hour",
    }));
    expect(result.overallScore).toBeLessThanOrEqual(45);
    expect(result.recommendedAction).toMatch(/low fit/i);
  });

  it("caps a role whose only skill signal is one loosely bridged skill", () => {
    const result = matchJob(profile, prefs, baseJob({
      title: "Freelance Writer",
      description: "Write articles. Content writing experience preferred.",
      skillsRequired: ["Content Writing"],
      location: "Worldwide",
      city: "",
      country: "Worldwide",
      remoteStatus: "remote",
    }));
    expect(result.overallScore).toBeLessThanOrEqual(60);
  });

  it("does not let a trainee label hide a senior experience requirement", () => {
    const result = matchJob(profile, prefs, baseJob({
      title: "Lead - Customer Success",
      description: "Lead the customer success team. Requires 7-10 years of experience.",
      employmentType: "trainee",
      skillsRequired: ["Customer Success", "Communication"],
    }));
    expect(result.qualified).toBe(false);
    expect(result.experienceScore).toBeLessThanOrEqual(20);
    expect(result.recommendedAction).toMatch(/skip/i);
  });
});
