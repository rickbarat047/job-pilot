import { describe, expect, it } from "vitest";
import { buildApplicationQuestions } from "./tailor";
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
  strengths: ["CAD", "Automotive Engineering"],
  roleFamily: "Automotive & EV Engineering",
} as JobMatchResult;

describe("application question drafts", () => {
  it("never serialises skill objects into a question answer", () => {
    const questions = buildApplicationQuestions(profile, preferences, job, match);
    for (const question of questions) {
      expect(question.answer).not.toContain("[object Object]");
    }
  });

  it("describes a fresher accurately using only profile facts", () => {
    const questions = buildApplicationQuestions(profile, preferences, job, match);
    const answer = questions.find((question) => question.question === "What relevant experience do you bring?")?.answer ?? "";
    expect(answer).toContain("fresher");
    expect(answer).toContain("2 projects");
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
    expect(answer).toContain("1 experience entry and 1 project are listed");
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
});
