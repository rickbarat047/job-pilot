import type { CandidatePreferences, CandidateProfile, JobMatchResult, MatchWeights, NormalizedJob } from "./types";
import {
  candidateRoleFamilies,
  classifyRole,
  extractSkills,
  ROLE_FAMILIES,
  skillsForProfile,
  SKILL_BRIDGES,
} from "./taxonomy";
import { parseEducationRequirements, parseExperience } from "./normalize";

export const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 30,
  education: 15,
  experience: 15,
  career: 15,
  location: 10,
  salary: 5,
  flexibility: 5,
  freshness: 5,
};

export const DEFAULT_PREFERENCES = {
  matchWeights: DEFAULT_WEIGHTS,
};

export function normalizeWeights(weights?: Partial<MatchWeights> | null): MatchWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...(weights ?? {}) };
  const total = Object.values(merged).reduce((sum, w) => sum + (Number.isFinite(w) ? Math.max(0, w) : 0), 0) || 1;
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, (Math.max(0, Number(v) || 0) / total) * 100]),
  ) as unknown as MatchWeights;
}

export function candidateYears(profile: CandidateProfile): number {
  if (Number.isFinite(profile.experienceYears) && profile.experienceYears > 0) return profile.experienceYears;
  const all = [...(profile.experience ?? []), ...(profile.internships ?? [])];
  if (all.length === 0) return 0;
  const internshipOnly = (profile.experience ?? []).length === 0;
  return internshipOnly ? 0.5 : Math.max(0, all.length);
}

export function profileSkillSet(profile: CandidateProfile): Set<string> {
  const set = skillsForProfile(profile);
  const text = [
    profile.summary,
    profile.headline,
    profile.degree,
    ...(profile.experience ?? []).map((e) => `${e.role} ${e.company} ${e.description} ${(e.highlights ?? []).join(" ")}`),
    ...(profile.internships ?? []).map((e) => `${e.role} ${e.company} ${e.description} ${(e.highlights ?? []).join(" ")}`),
    ...(profile.projects ?? []).map((p) => `${p.name} ${p.description} ${(p.technologies ?? []).join(" ")}`),
    ...(profile.certifications ?? []),
  ].join(" ");
  for (const skill of extractSkills(text, 60)) set.add(skill);
  return set;
}

function candidateLicenses(profile: CandidateProfile): Set<string> {
  const text = `${profile.degree} ${(profile.education ?? []).map((e) => `${e.degree} ${e.field}`).join(" ")} ${profile.headline}`.toLowerCase();
  const licenses = new Set<string>();
  if (/\b(ca|chartered accountant|icwa|icai)\b/.test(text)) licenses.add("CA / ICWA");
  if (/\b(mbbs|md|bds|nursing|registered nurse|rn)\b/.test(text)) licenses.add("Medical / nursing qualification");
  if (/\b(llb|law degree)\b/.test(text)) licenses.add("Law degree");
  if (/\b(mba|pgdm)\b/.test(text)) licenses.add("MBA / PGDM");
  return licenses;
}

function educationFit(profile: CandidateProfile, job: NormalizedJob): { score: number; notes: string[]; disqualifiers: string[] } {
  const req = job.educationRequirements ?? parseEducationRequirements(job.description);
  const notes: string[] = [];
  const disqualifiers: string[] = [];
  const degreeText = `${profile.degree} ${(profile.education ?? []).map((e) => e.degree).join(" ")}`.toLowerCase();
  const isEngineering = /\b(b\.?tech|b\.?e\b|engineering|automobile|mechanical)\b/.test(degreeText);
  const hasMBA = /\bmba\b|\bpgdm\b/.test(degreeText);
  const licenses = candidateLicenses(profile);

  if (!req) {
    notes.push("No explicit education requirement");
    return { score: isEngineering ? 0.78 : 0.65, notes, disqualifiers };
  }

  const licenseRequirements: { label: string; re: RegExp }[] = [
    { label: "CA / ICWA", re: /\b(ca|chartered accountant|icwa|icai)\b/i },
    { label: "Medical / nursing qualification", re: /\b(mbbs|md|bds|nursing|registered nurse|rn)\b/i },
    { label: "Law degree", re: /\b(llb|law degree)\b/i },
  ];
  for (const requirement of licenseRequirements) {
    if (requirement.re.test(req) && !licenses.has(requirement.label)) {
      disqualifiers.push(`Requires a professional qualification (${requirement.label}) that is not on your profile.`);
      return { score: 0, notes, disqualifiers };
    }
  }

  if (/\b(mba|pgdm)\b/i.test(req) && !hasMBA) {
    notes.push("Prefers an MBA/PGDM; your B.Tech is a partial fit");
    return { score: 0.5, notes, disqualifiers };
  }
  if (/\bb\.?tech|b\.?e\b|engineering/i.test(req)) {
    if (isEngineering) {
      notes.push("Your B.Tech meets the engineering degree requirement");
      return { score: 1, notes, disqualifiers };
    }
    notes.push("Engineering degree requested; verify equivalence");
    return { score: 0.3, notes, disqualifiers };
  }
  if (/any graduate|bachelor/i.test(req)) {
    notes.push("Your bachelor's degree meets the general graduate requirement");
    return { score: 0.92, notes, disqualifiers };
  }
  if (/\bb\.?com|commerce|finance/i.test(req) && !/\bb\.?com/i.test(degreeText)) {
    notes.push("Commerce background preferred; highlight analytical and numerical work");
    return { score: 0.6, notes, disqualifiers };
  }
  return { score: 0.75, notes, disqualifiers };
}

function skillFit(profile: CandidateProfile, job: NormalizedJob): { score: number; strengths: string[]; gaps: string[]; evaluated: number } {
  const candidate = profileSkillSet(profile);
  const jobSkills = job.skillsRequired.length ? job.skillsRequired : extractSkills(job.description, 20);
  if (jobSkills.length === 0) {
    return { score: 0.55, strengths: ["No specific technical skills listed; generalist profile considered"], gaps: [], evaluated: 0 };
  }
  const titleSkills = new Set(extractSkills(job.title, 10));
  let totalWeight = 0;
  let matchedWeight = 0;
  let transferableWeight = 0;
  const strengths: string[] = [];
  const gaps: string[] = [];

  for (const skill of jobSkills) {
    const weight = titleSkills.has(skill) ? 2 : 1;
    totalWeight += weight;
    if (candidate.has(skill)) {
      matchedWeight += weight;
      strengths.push(skill);
      continue;
    }
    const transferable = [...candidate].some((owned) => (SKILL_BRIDGES[owned] ?? []).includes(skill));
    if (transferable) {
      transferableWeight += weight * 0.35;
      continue;
    }
    gaps.push(skill);
  }
  const score = totalWeight ? Math.min(1, (matchedWeight + transferableWeight) / totalWeight) : 0.5;
  return {
    score,
    strengths: strengths.slice(0, 8),
    gaps: gaps.slice(0, 8),
    evaluated: jobSkills.length,
  };
}

function experienceFit(profile: CandidateProfile, job: NormalizedJob): { score: number; label: string; disqualifier: string | null; fresherFriendly: boolean } {
  const years = candidateYears(profile);
  const parsed = parseExperience(job.description, job.title);
  const min = parsed.minYears;
  const entryLevelTitle = /intern|trainee|apprentice|graduate|fresher/i.test(`${job.title} ${job.employmentType}`);
  const entryLevelType = job.employmentType === "internship" || job.employmentType === "apprenticeship" || job.employmentType === "trainee";
  if (min === null) {
    return { score: entryLevelTitle ? 1 : 0.65, label: "Not specified", disqualifier: null, fresherFriendly: entryLevelTitle };
  }
  // A mislabeled "trainee" employment type must not hide a senior requirement.
  // Only treat an entry-level label as a fresher override when the title is
  // not senior and the posting actually asks for one year or less.
  const seniorTitle = /\b(senior|sr\.?|lead|principal|staff|manager|director|head|vp|architect)\b/i.test(job.title);
  if (!seniorTitle && min <= 1 && (entryLevelTitle || entryLevelType)) {
    return { score: years <= 2 ? 1 : 0.8, label: parsed.label ?? `${min}+ years`, disqualifier: null, fresherFriendly: true };
  }
  const gap = min - years;
  let score = 0.5;
  if (gap <= 0) score = 1;
  else if (gap <= 1) score = 0.8;
  else if (gap <= 2) score = 0.55;
  else if (gap <= 3) score = 0.3;
  else score = 0.1;
  const disqualifier = gap >= 3 ? `This role asks for ${parsed.label ?? `${min}+ years`}; your profile shows about ${years} year${years === 1 ? "" : "s"}.` : null;
  return { score, label: parsed.label ?? `${min}+ years`, disqualifier, fresherFriendly: false };
}

function locationFit(profile: CandidateProfile, prefs: CandidatePreferences, job: NormalizedJob): { score: number; note: string } {
  const remote = job.remoteStatus === "remote";
  const preferred = (prefs.preferredLocations ?? []).map((l) => l.toLowerCase());
  const city = (job.city ?? "").toLowerCase();
  const jobLoc = job.location.toLowerCase();
  const cityMatch = preferred.some((p) => p && (p === city || jobLoc.includes(p)));

  if (remote) {
    if (job.country === "India" || job.country === "Worldwide" || job.country === "Unknown") {
      if (prefs.remoteIndia || prefs.workModes?.includes("Remote") || prefs.internationalRemote) {
        return { score: 1, note: job.country === "Worldwide" ? "Remote-friendly and open to India-based candidates" : "Remote role in India" };
      }
      return { score: 0.6, note: "Remote role, but remote work is not in your preferences" };
    }
    if (prefs.internationalRemote) return { score: 0.9, note: `Remote role based in ${job.country}` };
    return { score: 0.15, note: `Remote role restricted to ${job.country}; international remote is off` };
  }

  if (job.country !== "India") {
    return { score: 0.1, note: `On-site role outside India (${job.country || "unknown"})` };
  }
  if (cityMatch) return { score: 1, note: `${job.city} is in your preferred locations` };
  if (prefs.allIndia) return { score: 0.9, note: `India-based role in ${job.city ?? job.location}` };
  if (prefs.flexibility?.willingToRelocate) return { score: 0.7, note: `India-based; you are open to relocating to ${job.city ?? job.location}` };
  return { score: 0.35, note: `India-based role in ${job.city ?? job.location}, outside your preferred locations` };
}

function salaryFit(prefs: CandidatePreferences, job: NormalizedJob): { score: number; note: string } {
  if (!prefs.minSalaryLpa || prefs.salaryFlexible) return { score: 0.8, note: "Salary expectation is flexible" };
  if (job.salaryCurrency !== "INR" || (!job.salaryMin && !job.salaryMax)) {
    return { score: 0.6, note: "Salary not disclosed; verify before applying" };
  }
  const top = job.salaryMax ?? job.salaryMin ?? 0;
  const bottom = job.salaryMin ?? job.salaryMax ?? 0;
  if (top >= prefs.minSalaryLpa) return { score: 1, note: `Salary range meets your ₹${prefs.minSalaryLpa} LPA target` };
  if (top >= prefs.minSalaryLpa * 0.8) return { score: 0.65, note: `Salary range is close to your ₹${prefs.minSalaryLpa} LPA target` };
  if (bottom > 0) return { score: 0.25, note: `Advertised salary is below your ₹${prefs.minSalaryLpa} LPA target` };
  return { score: 0.5, note: "Salary information is incomplete" };
}

function careerFit(profile: CandidateProfile, prefs: CandidatePreferences, job: NormalizedJob): { score: number; roleFamily: string; note: string } {
  const family = classifyRole(job.title, job.description);
  const preferredFamilies = candidateRoleFamilies(profile, prefs);
  const targetMatch = (prefs.targetRoles ?? []).some((role) => {
    const tokens = role.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    return tokens.length > 0 && tokens.every((t) => job.title.toLowerCase().includes(t));
  });
  if (targetMatch) return { score: 1, roleFamily: family.label, note: `Title matches your target role "${prefs.targetRoles.find((r) => job.title.toLowerCase().includes(r.toLowerCase().split(/\s+/)[0]))}"` };
  if (preferredFamilies.has(family.label)) {
    return { score: 0.95, roleFamily: family.label, note: `${family.label} is a strong fit for your background` };
  }
  if (prefs.flexibility?.anyRole) {
    if (!prefs.flexibility.nonCore && family.label !== "Automotive & EV Engineering" && family.label !== "Mechanical Design & CAE" && family.label !== "Manufacturing, Quality & Operations Engineering") {
      return { score: 0.45, roleFamily: family.label, note: `${family.label} is outside core engineering; enable non-core roles to prioritise it` };
    }
    return { score: 0.72, roleFamily: family.label, note: `${family.label} is adjacent to your profile; you asked for any suitable role` };
  }
  const adjacent = ROLE_FAMILIES.filter((r) => r.key !== family.key && preferredFamilies.has(r.label));
  const hasBridge = adjacent.some((r) => (r.adjacentSkills ?? []).some((s) => profileSkillSet(profile).has(s)));
  if (hasBridge) return { score: 0.6, roleFamily: family.label, note: `${family.label} is adjacent to your target career paths` };
  return { score: 0.3, roleFamily: family.label, note: `${family.label} is outside your selected career paths` };
}

function flexibilityFit(profile: CandidateProfile, prefs: CandidatePreferences, job: NormalizedJob): { score: number; note: string } {
  let score = 0.55;
  const f = prefs.flexibility ?? {
    anyIndustry: true, anyRole: true, willingToLearn: true, willingToRelocate: false,
    willingToRemote: false, entryLevel: true, startups: true, nonCore: true,
  };
  if (f.anyRole) score += 0.1;
  if (f.anyIndustry) score += 0.05;
  if (f.willingToLearn) score += 0.05;
  if (f.entryLevel && /intern|trainee|apprentice|graduate|fresher/i.test(`${job.title} ${job.employmentType}`)) score += 0.1;
  if (f.nonCore && !/engineer|automotive|mechanical|manufacturing|quality/i.test(job.title)) score += 0.05;
  if (f.startups) score += 0.03;
  const employment = prefs.employmentTypes ?? [];
  const typeMap: Record<string, string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", internship: "Internship", apprenticeship: "Apprenticeship", trainee: "Graduate trainee", temporary: "Contract", unknown: "" };
  if (employment.length && typeMap[job.employmentType] && employment.includes(typeMap[job.employmentType])) score += 0.08;
  else if (employment.length && job.employmentType !== "unknown") score -= 0.05;
  const level = prefs.experienceLevels ?? [];
  if (level.includes("Fresher") && /fresher|0-1|entry/i.test(`${job.experienceRequired} ${job.description.slice(0, 500)}`)) score += 0.05;
  return { score: Math.max(0, Math.min(1, score)), note: f.anyRole ? "You are open to a broad range of roles" : "Scored against your selected role preferences" };
}

function freshnessFit(job: NormalizedJob): { score: number; note: string } {
  if (job.status === "expired") return { score: 0, note: "Listing appears expired" };
  if (!job.postedAt) return { score: 0.55, note: "Posting date unavailable" };
  const age = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000;
  if (Number.isNaN(age) || age < 0) return { score: 0.6, note: "Posting date could not be verified" };
  if (age <= 2) return { score: 1, note: "Posted in the last 48 hours" };
  if (age <= 7) return { score: 0.9, note: "Posted this week" };
  if (age <= 14) return { score: 0.78, note: "Posted in the last two weeks" };
  if (age <= 30) return { score: 0.62, note: "Posted this month" };
  if (age <= 60) return { score: 0.4, note: "Posted 1–2 months ago; verify it is still open" };
  return { score: 0.2, note: "Older posting; verify it is still open" };
}

function dedupeStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/**
 * Hybrid deterministic matcher. AI adds a semantic second opinion on the job
 * detail page, but never overrides hard disqualifiers or invents skills.
 */
export function matchJob(profile: CandidateProfile, prefs: CandidatePreferences, job: NormalizedJob): JobMatchResult {
  const weights = normalizeWeights(prefs.matchWeights);
  const skills = skillFit(profile, job);
  const education = educationFit(profile, job);
  const experience = experienceFit(profile, job);
  const career = careerFit(profile, prefs, job);
  const location = locationFit(profile, prefs, job);
  const salary = salaryFit(prefs, job);
  const flexibility = flexibilityFit(profile, prefs, job);
  const freshness = freshnessFit(job);

  const disqualifiers = dedupeStrings([...education.disqualifiers, ...(experience.disqualifier ? [experience.disqualifier] : [])]);
  const qualified = disqualifiers.length === 0;

  const overall =
    skills.score * weights.skills +
    education.score * weights.education +
    experience.score * weights.experience +
    career.score * weights.career +
    location.score * weights.location +
    salary.score * weights.salary +
    flexibility.score * weights.flexibility +
    freshness.score * weights.freshness;

  // A role that lists skills and shares none of them (directly or through a
  // bridge) is not a strong fit, even if location, salary and freshness are
  // perfect. A single loosely bridged skill is also thin evidence when the
  // role is outside the candidate's preferred career families. Without these
  // caps, unrelated remote roles such as "Freelance Writer" could score above
  // 80 for an engineering profile.
  const skillMismatch = skills.score === 0;
  const thinSkillEvidence = skills.evaluated <= 1 && career.score <= 0.72;
  const relevanceCap = skillMismatch ? 45 : thinSkillEvidence ? 60 : 100;
  const finalScore = Math.max(0, Math.min(100, Math.round(Math.min(overall, relevanceCap))));
  const missingRequirements = dedupeStrings([
    ...skills.gaps.map((g) => `Skill gap: ${g}`),
    ...(education.notes.filter((n) => /prefers|partial|verify|equivalence/i.test(n)) ?? []),
    ...(experience.disqualifier ? [experience.disqualifier] : []),
  ]).slice(0, 8);

  const strengths = dedupeStrings([
    ...skills.strengths,
    ...education.notes.filter((n) => /meets|fits|degree|bachelor/i.test(n) && !/partial|verify/i.test(n)),
    ...(experience.fresherFriendly ? ["Fresher-friendly role"] : []),
    ...(location.score >= 0.9 ? ["Strong location fit"] : []),
  ]).slice(0, 8);

  const explanationParts = [
    `${career.note}.`,
    skills.strengths.length
      ? `Your profile overlaps on ${skills.strengths.length} of ${job.skillsRequired.length || skills.strengths.length} detected skills, including ${skills.strengths.slice(0, 4).join(", ")}.`
      : "No direct skill overlap was detected from the job description, so the match score is capped.",
    education.notes[0] ? `${education.notes[0]}.` : "",
    experience.label ? `Experience requested: ${experience.label}; you have about ${candidateYears(profile)} year${candidateYears(profile) === 1 ? "" : "s"}.` : "",
    location.note ? `${location.note}.` : "",
    salary.note ? `${salary.note}.` : "",
    skills.gaps.length ? `Gaps to address honestly: ${skills.gaps.slice(0, 4).join(", ")}.` : "",
    disqualifiers.length ? `Mandatory gap: ${disqualifiers.join(" ")}` : "",
  ].filter(Boolean);

  let recommendedAction = "Review the role";
  if (!qualified) recommendedAction = "Skip unless you can close the mandatory gap";
  else if (finalScore >= 80) recommendedAction = "Strong fit — tailor and apply";
  else if (finalScore >= 65) recommendedAction = "Good fit — tailor your resume before applying";
  else if (finalScore >= 50) recommendedAction = "Partial fit — apply only if the role excites you";
  else recommendedAction = "Low fit — consider a more targeted role";

  return {
    overallScore: finalScore,
    skillScore: Math.round(skills.score * 100),
    educationScore: Math.round(education.score * 100),
    experienceScore: Math.round(experience.score * 100),
    careerScore: Math.round(career.score * 100),
    locationScore: Math.round(location.score * 100),
    salaryScore: Math.round(salary.score * 100),
    flexibilityScore: Math.round(flexibility.score * 100),
    freshnessScore: Math.round(freshness.score * 100),
    strengths,
    gaps: skills.gaps,
    missingRequirements,
    explanation: explanationParts.join(" "),
    recommendedAction,
    qualified,
    disqualifiers,
    roleFamily: career.roleFamily,
    semanticSummary: null,
  };
}

export function scoreBand(score: number): { label: string; tone: "high" | "mid" | "low" } {
  if (score >= 75) return { label: "Strong", tone: "high" };
  if (score >= 55) return { label: "Moderate", tone: "mid" };
  return { label: "Stretch", tone: "low" };
}
