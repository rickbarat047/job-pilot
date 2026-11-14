import { describe, expect, it } from "vitest";
import { buildApplicationQuestions, buildCoverLetter } from "./tailor";
import type { CandidatePreferences, CandidateProfile, JobMatchResult, NormalizedJob } from "../types";

const profile: CandidateProfile = {
  userId: "usr_test",
  fullName: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "+919876543210",
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  headline: "B.Tech Automobile Engineering graduate",
  summary: "Automobile engineering graduate interested in vehicle systems.",
  degree: "B.Tech Automobile Engineering",
  university: "Visvesvaraya Technological University",
  graduationYear: "2025",
  cgpa: "7.8",
  experienceYears: 0,
  currentStatus: "Fresher",
  noticePeriod: "Immediate",
  languages: ["English"],
  skills: [
    { name: "Automotive Engineering" },
    { name: "CAD" },
    { name: "SolidWorks" },
  ],
  experience: [],
  internships: [],
  projects: [
    { name: "Hybrid Go-Kart Powertrain", description: "Designed a hybrid powertrain." },
    { name: "EV Battery Pack Thermal Study", description: "Studied battery thermal behaviour." },
  ],
  certifications: [],
  education: [],
  rawCvText: "",
};

const preferences: CandidatePreferences = {
  targetRoles: ["Graduate Engineer Trainee"],
  experienceLevels: ["fresher"],
  employmentTypes: ["full-time"],
  workModes: ["onsite"],
  preferredLocations: ["Bengaluru"],
  allIndia: false,
  remoteIndia: false,
  internationalRemote: false,
  minSalaryLpa: null,
  salaryFlexible: true,
  unpaidInternship: false,
  paidInternship: true,
  industries: ["Automotive"],
  flexibility: {
    anyIndustry: true,
    anyRole: true,
    willingToLearn: true,
    willingToRelocate: true,
    willingToRemote: true,
    entryLevel: true,
    startups: true,
    nonCore: false,
  },
  matchWeights: {
    skills: 30, education: 15, experience: 15, career: 10,
    location: 10, salary: 5, flexibility: 10, freshness: 5,
  },
};

const job = {
  id: "job_test",
  title: "Graduate Engineer Trainee",
  companyName: "Bosch Group",
} as NormalizedJob;

const match = {
  overallScore: 88,
  skillScore: 90,
  educationScore: 80,
  experienceScore: 80,
  careerScore: 85,
  locationScore: 90,
  salaryScore: 80,
  flexibilityScore: 80,
  freshnessScore: 90,
  strengths: ["CAD", "Automotive Engineering"],
  gaps: [],
  missingRequirements: [],
  explanation: "Good profile overlap.",
  recommendedAction: "Proceed to review.",
  qualified: true,
  disqualifiers: [],
  roleFamily: "Automotive & EV Engineering",
} as JobMatchResult;

describe("application question drafts", () => {
  it("never serialises skill objects into a question answer", () => {
    const questions = buildApplicationQuestions(profile, preferences, job, match);
    for (const question of questions) {
      expect(question.answer).not.toContain("[object Object]");
    }
  });

  it("describes work and project entries accurately using only profile facts", () => {
    const questions = buildApplicationQuestions(profile, preferences, job, match);
    const answer = questions.find((question) => question.question === "What relevant experience do you bring?")?.answer ?? "";
    expect(answer).toContain("No work or internship entries are listed in my profile.");
    expect(answer).toContain("2 projects");
    expect(answer).toContain("Hybrid Go-Kart Powertrain");
    expect(answer).toContain("EV Battery Pack Thermal Study");
    expect(answer).toContain("Automotive Engineering");
    expect(answer).toContain("CAD");
    expect(answer).toContain("SolidWorks");
    expect(answer).not.toContain("experience entries");
  });

  it("uses singular labels for one experience entry and one project", () => {
    const withExperience: CandidateProfile = {
      ...profile,
      experience: [{ role: "Engineering Intern", company: "ABC Auto", description: "Supported quality checks." }],
      projects: [{ name: "Suspension Study", description: "Analysed suspension geometry." }],
    };
    const questions = buildApplicationQuestions(withExperience, preferences, job, match);
    const answer = questions.find((question) => question.question === "What relevant experience do you bring?")?.answer ?? "";
    expect(answer).toContain("1 work or internship entry is listed in my profile.");
    expect(answer).toContain("Engineering Intern at ABC Auto");
    expect(answer).toContain("My profile includes 1 project: Suspension Study");
  });

  it("keeps demographic and consent questions for explicit approval", () => {
    const questions = buildApplicationQuestions(profile, preferences, job, match);
    const sensitive = questions.filter((question) => question.sensitive);
    expect(sensitive.length).toBeGreaterThan(0);
    for (const question of sensitive) {
      expect(question.requiresApproval).toBe(true);
      expect(question.answer).toBe("");
    }
  });

  it("does not invent availability, salary, relocation or remote-work preferences", () => {
    const unknownPreferences: CandidatePreferences = {
      ...preferences,
      salaryFlexible: false,
      minSalaryLpa: null,
      flexibility: { ...preferences.flexibility!, willingToRelocate: false, willingToRemote: false },
    };
    const questions = buildApplicationQuestions({ ...profile, noticePeriod: "" }, unknownPreferences, job, match);
    for (const label of [
      "What is your notice period or availability?",
      "What are your salary expectations?",
      "Are you willing to relocate?",
      "Are you willing to work remotely or in a hybrid model?",
    ]) {
      const question = questions.find((item) => item.question === label);
      expect(question?.answer).toBe("");
      expect(question?.requiresApproval).toBe(true);
    }
  });
});

describe("cover-letter drafts", () => {
  it("uses candidate-provided work and project details and does not claim an attachment", () => {
    const candidate: CandidateProfile = {
      ...profile,
      experience: [{ role: "Engineering Intern", company: "ABC Auto", description: "Supported quality checks on vehicle components." }],
      projects: [
        { name: "Battery Thermal Study", description: "Studied battery pack temperatures.", technologies: ["THERMAL MODELING"] },
        { name: "Go-Kart Frame", description: "Designed a frame in CAD.", technologies: ["CAD"] },
      ],
    };
    const targetJob = { ...job, skillsRequired: ["cad"] } as NormalizedJob;
    const targetMatch = { ...match, strengths: ["CAD", "Unlisted Pro Tool"] } as JobMatchResult;
    const letter = buildCoverLetter(candidate, targetJob, targetMatch);

    expect(letter).toContain("Engineering Intern at ABC Auto: Supported quality checks on vehicle components.");
    expect(letter.indexOf("Go-Kart Frame")).toBeLessThan(letter.indexOf("Battery Thermal Study"));
    expect(letter).toContain("through CAD");
    expect(letter).not.toContain("Unlisted Pro Tool");
    expect(letter).not.toMatch(/attached my resume/i);
  });

  it("does not imply work experience or projects when none are listed", () => {
    const candidate = { ...profile, experience: [], internships: [], projects: [] };
    const letter = buildCoverLetter(candidate, { ...job, skillsRequired: [] } as NormalizedJob, match);
    expect(letter).not.toMatch(/my profile lists|a project in my profile/i);
  });
});
