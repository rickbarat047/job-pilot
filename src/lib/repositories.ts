import { all, get, newId, nowIso, parseJson, run, toBoolInt, toJson } from "./db";
import type {
  ApplicationState,
  CandidateExperience,
  CandidatePreferences,
  CandidateProfile,
  CandidateProject,
  CandidateSkill,
  JobMatchResult,
  NormalizedJob,
} from "./types";
import { DEFAULT_WEIGHTS } from "./matching";
import { DEFAULT_PERMISSIONS, type UserPermissions } from "./permissions";
import { fromBoolInt } from "./db";

type Row = Record<string, unknown>;
const s = (v: unknown, fallback = ""): string => {
  if (v === null || v === undefined) return fallback;
  // Postgres returns timestamptz columns as Date objects. Stringify those as ISO
  // timestamps rather than JSON (which would add an extra pair of quotes and
  // break `new Date(value)` on the client).
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const n = (v: unknown, fallback = 0): number => (v === null || v === undefined ? fallback : Number(v));
const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function getProfile(userId: string): Promise<CandidateProfile> {
  const row = await get<Row>("SELECT * FROM candidate_profiles WHERE user_id = ?", [userId]);
  if (!row) {
    return {
      userId, fullName: "", email: "", phone: "", city: "", state: "", country: "India",
      linkedinUrl: "", githubUrl: "", portfolioUrl: "", headline: "", summary: "", degree: "",
      university: "", graduationYear: "", cgpa: "", experienceYears: 0, currentStatus: "Fresher",
      noticePeriod: "", languages: [], skills: [], experience: [], internships: [], projects: [],
      certifications: [], education: [], rawCvText: "",
    };
  }
  const extra = parseJson<{
    experience?: CandidateExperience[];
    internships?: CandidateExperience[];
    projects?: CandidateProject[];
    certifications?: string[];
    education?: { degree: string; field?: string | null; university: string; graduationYear?: string | null; score?: string | null }[];
  }>(s(row.profile_json, "{}"), {});
  const skills = (await all<Row>("SELECT * FROM candidate_skills WHERE user_id = ? ORDER BY category, name", [userId])).map((r) => ({
    id: s(r.id),
    name: s(r.name),
    category: s(r.category),
    proficiency: s(r.proficiency),
    years: nullableNum(r.years),
    source: s(r.source),
  }));
  return {
    userId,
    fullName: s(row.full_name),
    email: s(row.email),
    phone: s(row.phone),
    city: s(row.city),
    state: s(row.state),
    country: s(row.country, "India"),
    linkedinUrl: s(row.linkedin_url),
    githubUrl: s(row.github_url),
    portfolioUrl: s(row.portfolio_url),
    headline: s(row.headline),
    summary: s(row.summary),
    degree: s(row.degree),
    university: s(row.university),
    graduationYear: s(row.graduation_year),
    cgpa: s(row.cgpa),
    experienceYears: n(row.experience_years),
    currentStatus: s(row.current_status, "Fresher"),
    noticePeriod: s(row.notice_period),
    languages: parseJson<string[]>(s(row.languages, "[]"), []),
    skills,
    experience: extra.experience ?? [],
    internships: extra.internships ?? [],
    projects: extra.projects ?? [],
    certifications: extra.certifications ?? [],
    education: extra.education ?? [],
    rawCvText: s(row.raw_cv_text),
  };
}

export async function saveProfile(userId: string, profile: Partial<CandidateProfile> & { skills?: CandidateSkill[] }): Promise<CandidateProfile> {
  const current = await getProfile(userId);
  const merged = { ...current, ...profile, userId };
  const extra = {
    experience: profile.experience ?? current.experience,
    internships: profile.internships ?? current.internships,
    projects: profile.projects ?? current.projects,
    certifications: profile.certifications ?? current.certifications,
    education: profile.education ?? current.education,
  };
  const now = nowIso();
  await run(
    `UPDATE candidate_profiles SET full_name=?, email=?, phone=?, city=?, state=?, country=?, linkedin_url=?, github_url=?,
     portfolio_url=?, headline=?, summary=?, degree=?, university=?, graduation_year=?, cgpa=?, experience_years=?,
     current_status=?, notice_period=?, languages=?, raw_cv_text=?, profile_json=?, updated_at=? WHERE user_id=?`,
    [
      merged.fullName, merged.email, merged.phone, merged.city, merged.state, merged.country || "India",
      merged.linkedinUrl, merged.githubUrl, merged.portfolioUrl, merged.headline, merged.summary,
      merged.degree, merged.university, merged.graduationYear, merged.cgpa, merged.experienceYears,
      merged.currentStatus, merged.noticePeriod, toJson(merged.languages), merged.rawCvText, toJson(extra), now, userId,
    ],
  );
  if (profile.skills) {
    await run("DELETE FROM candidate_skills WHERE user_id = ?", [userId]);
    for (const skill of profile.skills) {
      if (!skill.name?.trim()) continue;
      await run(
        "INSERT INTO candidate_skills (id, user_id, name, category, proficiency, years, source) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, name) DO NOTHING",
        [newId("skl"), userId, skill.name.trim(), skill.category ?? null, skill.proficiency ?? null, skill.years ?? null, skill.source ?? "profile"],
      );
    }
  }
  return await getProfile(userId);
}

export async function getPreferences(userId: string): Promise<CandidatePreferences> {
  const row = await get<Row>("SELECT * FROM candidate_preferences WHERE user_id = ?", [userId]);
  const defaults: CandidatePreferences = {
    targetRoles: [], experienceLevels: ["Fresher", "Entry-level"], employmentTypes: ["Full-time", "Internship", "Graduate trainee"],
    workModes: ["On-site", "Hybrid", "Remote"], preferredLocations: [], allIndia: true, remoteIndia: true,
    internationalRemote: false, minSalaryLpa: null, salaryFlexible: true, unpaidInternship: false, paidInternship: true,
    industries: [], flexibility: { anyIndustry: true, anyRole: true, willingToLearn: true, willingToRelocate: false, willingToRemote: true, entryLevel: true, startups: true, nonCore: true },
    matchWeights: DEFAULT_WEIGHTS,
  };
  if (!row) return defaults;
  return {
    targetRoles: parseJson(s(row.target_roles, "[]"), []),
    experienceLevels: parseJson(s(row.experience_levels, "[]"), defaults.experienceLevels),
    employmentTypes: parseJson(s(row.employment_types, "[]"), defaults.employmentTypes),
    workModes: parseJson(s(row.work_modes, "[]"), defaults.workModes),
    preferredLocations: parseJson(s(row.preferred_locations, "[]"), []),
    allIndia: fromBoolInt(n(row.all_india, 1)),
    remoteIndia: fromBoolInt(n(row.remote_india, 1)),
    internationalRemote: fromBoolInt(n(row.international_remote)),
    minSalaryLpa: nullableNum(row.min_salary_lpa),
    salaryFlexible: fromBoolInt(n(row.salary_flexible, 1)),
    unpaidInternship: fromBoolInt(n(row.unpaid_internship)),
    paidInternship: fromBoolInt(n(row.paid_internship, 1)),
    industries: parseJson(s(row.industries, "[]"), []),
    flexibility: { ...defaults.flexibility, ...parseJson(s(row.flexibility, "{}"), {}) },
    matchWeights: { ...DEFAULT_WEIGHTS, ...parseJson(s(row.match_weights, "{}"), {}) },
  };
}

export async function savePreferences(userId: string, prefs: CandidatePreferences): Promise<CandidatePreferences> {
  const current = await getPreferences(userId);
  const merged = { ...current, ...prefs };
  await run(
    `UPDATE candidate_preferences SET target_roles=?, experience_levels=?, employment_types=?, work_modes=?, preferred_locations=?,
     all_india=?, remote_india=?, international_remote=?, min_salary_lpa=?, salary_flexible=?, unpaid_internship=?,
     paid_internship=?, industries=?, flexibility=?, match_weights=?, updated_at=? WHERE user_id=?`,
    [
      toJson(merged.targetRoles), toJson(merged.experienceLevels), toJson(merged.employmentTypes), toJson(merged.workModes),
      toJson(merged.preferredLocations), toBoolInt(merged.allIndia), toBoolInt(merged.remoteIndia), toBoolInt(merged.internationalRemote),
      merged.minSalaryLpa, toBoolInt(merged.salaryFlexible), toBoolInt(merged.unpaidInternship), toBoolInt(merged.paidInternship),
      toJson(merged.industries), toJson(merged.flexibility), toJson(merged.matchWeights), nowIso(), userId,
    ],
  );
  return await getPreferences(userId);
}

export async function getPermissionsForUser(userId: string): Promise<UserPermissions> {
  const row = await get<Row>("SELECT * FROM user_permissions WHERE user_id = ?", [userId]);
  if (!row) return { ...DEFAULT_PERMISSIONS };
  return {
    autonomyLevel: Number(row.autonomy_level) as UserPermissions["autonomyLevel"],
    searchJobs: s(row.search_jobs, "automatic") as UserPermissions["searchJobs"],
    analyzeJobs: s(row.analyze_jobs, "automatic") as UserPermissions["analyzeJobs"],
    matchJobs: s(row.match_jobs, "automatic") as UserPermissions["matchJobs"],
    generateResumes: s(row.generate_resumes, "automatic") as UserPermissions["generateResumes"],
    generateCoverLetters: s(row.generate_cover_letters, "automatic") as UserPermissions["generateCoverLetters"],
    saveDrafts: s(row.save_drafts, "automatic") as UserPermissions["saveDrafts"],
    submitApplications: s(row.submit_applications, "approval") as UserPermissions["submitApplications"],
    sendRecruiterEmails: s(row.send_recruiter_emails, "approval") as UserPermissions["sendRecruiterEmails"],
    answerSensitiveQuestions: s(row.answer_sensitive_questions, "approval") as UserPermissions["answerSensitiveQuestions"],
    acceptOffers: "never",
    sharePersonalInfo: s(row.share_personal_info, "approval") as UserPermissions["sharePersonalInfo"],
    autoApplyCategories: parseJson(s(row.auto_apply_categories, "[]"), []),
    autoApplyMinScore: n(row.auto_apply_min_score, 85),
    allowDuplicateApplications: n(row.allow_duplicate_applications) === 1,
    demoMode: n(row.demo_mode, 1) === 1,
  };
}

export async function savePermissions(userId: string, permissions: UserPermissions): Promise<void> {
  await run(
    `UPDATE user_permissions SET autonomy_level=?, search_jobs=?, analyze_jobs=?, match_jobs=?, generate_resumes=?,
     generate_cover_letters=?, save_drafts=?, submit_applications=?, send_recruiter_emails=?, answer_sensitive_questions=?,
     accept_offers='never', share_personal_info=?, auto_apply_categories=?, auto_apply_min_score=?, allow_duplicate_applications=?,
     demo_mode=?, updated_at=? WHERE user_id=?`,
    [
      permissions.autonomyLevel, permissions.searchJobs, permissions.analyzeJobs, permissions.matchJobs,
      permissions.generateResumes, permissions.generateCoverLetters, permissions.saveDrafts, permissions.submitApplications,
      permissions.sendRecruiterEmails, permissions.answerSensitiveQuestions, permissions.sharePersonalInfo,
      toJson(permissions.autoApplyCategories), permissions.autoApplyMinScore, toBoolInt(permissions.allowDuplicateApplications),
      toBoolInt(permissions.demoMode), nowIso(), userId,
    ],
  );
}

export async function getJobById(jobId: string): Promise<NormalizedJob | null> {
  const row = await get<Row>("SELECT * FROM jobs WHERE id = ?", [jobId]);
  return row ? mapJob(row) : null;
}

export function mapJob(row: Row): NormalizedJob {
  return {
    id: s(row.id),
    title: s(row.title),
    companyName: s(row.company_name),
    companySlug: s(row.company_name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    companyWebsite: s(row.company_website) || null,
    careerPageUrl: s(row.career_page_url) || null,
    description: s(row.description),
    descriptionHtml: s(row.description_html) || null,
    location: s(row.location),
    city: s(row.city) || null,
    country: s(row.country, "Unknown"),
    remoteStatus: s(row.remote_status, "unknown") as NormalizedJob["remoteStatus"],
    employmentType: s(row.employment_type, "unknown") as NormalizedJob["employmentType"],
    experienceRequired: s(row.experience_required) || null,
    educationRequirements: s(row.education_requirements) || null,
    skillsRequired: parseJson<string[]>(s(row.skills_required, "[]"), []),
    salaryMin: nullableNum(row.salary_min),
    salaryMax: nullableNum(row.salary_max),
    salaryCurrency: s(row.salary_currency) || null,
    salaryText: s(row.salary_text) || null,
    applicationUrl: s(row.application_url),
    applicationMethod: s(row.application_method, "external") as NormalizedJob["applicationMethod"],
    source: s(row.source),
    sourceJobId: s(row.source_job_id),
    postedAt: s(row.posted_at) || null,
    lastVerifiedAt: s(row.last_verified_at),
    status: s(row.status, "active") as NormalizedJob["status"],
    reliability: n(row.reliability, 0.8),
    fingerprint: s(row.fingerprint),
    raw: parseJson<unknown>(s(row.raw_json, "{}"), {}),
  };
}

export interface JobListItem {
  job: NormalizedJob;
  match: JobMatchResult & { aiSummary?: string | null };
  savedState: string | null;
  applicationId: string | null;
  applicationState: ApplicationState | null;
  companyIndustry: string | null;
  companyStage: string | null;
}

export interface JobFilters {
  query?: string;
  source?: string;
  location?: string;
  remote?: string;
  employment?: string;
  minScore?: number;
  saved?: boolean;
  shortlisted?: boolean;
  applied?: boolean;
  sort?: "match" | "newest" | "salary";
  page?: number;
  limit?: number;
}

export async function getJobsForUser(userId: string, filters: JobFilters = {}): Promise<{ items: JobListItem[]; total: number }> {
  const where: string[] = ["j.status != 'expired'", "m.user_id = ?"];
  const params: (string | number)[] = [userId];
  if (filters.query) {
    where.push("(j.title LIKE ? OR j.company_name LIKE ? OR j.description LIKE ?)");
    const q = `%${filters.query}%`;
    params.push(q, q, q);
  }
  if (filters.source) { where.push("j.source = ?"); params.push(filters.source); }
  if (filters.location) {
    where.push("(j.city LIKE ? OR j.location LIKE ?)");
    params.push(`%${filters.location}%`, `%${filters.location}%`);
  }
  if (filters.remote) { where.push("j.remote_status = ?"); params.push(filters.remote); }
  if (filters.employment) { where.push("j.employment_type = ?"); params.push(filters.employment); }
  if (filters.minScore) { where.push("m.overall_score >= ?"); params.push(filters.minScore); }
  if (filters.saved) where.push("s.id IS NOT NULL");
  if (filters.shortlisted) where.push("s.state = 'shortlisted'");
  if (filters.applied) where.push("a.id IS NOT NULL");
  const order = filters.sort === "newest" ? "j.posted_at DESC" : filters.sort === "salary" ? "j.salary_max DESC NULLS LAST, m.overall_score DESC" : "m.overall_score DESC, j.posted_at DESC";
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 24));
  const base = `FROM jobs j JOIN job_matches m ON m.job_id = j.id
    LEFT JOIN saved_jobs s ON s.job_id = j.id AND s.user_id = m.user_id
    LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = m.user_id
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE ${where.join(" AND ")}`;
  const totalRow = await get<{ c: number }>(`SELECT COUNT(*) as c ${base}`, params);
  const rows = await all<Row>(
    `SELECT j.*, m.overall_score, m.skill_score, m.education_score, m.experience_score, m.career_score,
      m.location_score, m.salary_score, m.flexibility_score, m.freshness_score, m.strengths, m.gaps,
      m.missing_requirements, m.disqualifiers, m.explanation, m.recommended_action, m.qualified, m.role_family,
      m.ai_summary, s.state as saved_state, a.id as application_id, a.state as application_state,
      c.industry as company_industry, c.stage as company_stage
     ${base} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );
  return { items: rows.map(mapJobListItem), total: Number(totalRow?.c ?? 0) };
}

export function mapJobListItem(row: Row): JobListItem {
  return {
    job: mapJob(row),
    match: {
      overallScore: n(row.overall_score),
      skillScore: n(row.skill_score),
      educationScore: n(row.education_score),
      experienceScore: n(row.experience_score),
      careerScore: n(row.career_score),
      locationScore: n(row.location_score),
      salaryScore: n(row.salary_score),
      flexibilityScore: n(row.flexibility_score),
      freshnessScore: n(row.freshness_score),
      strengths: parseJson<string[]>(s(row.strengths, "[]"), []),
      gaps: parseJson<string[]>(s(row.gaps, "[]"), []),
      missingRequirements: parseJson<string[]>(s(row.missing_requirements, "[]"), []),
      disqualifiers: parseJson<string[]>(s(row.disqualifiers, "[]"), []),
      explanation: s(row.explanation),
      recommendedAction: s(row.recommended_action),
      qualified: n(row.qualified, 1) === 1,
      roleFamily: s(row.role_family),
      semanticSummary: s(row.ai_summary) || null,
    },
    savedState: s(row.saved_state) || null,
    applicationId: s(row.application_id) || null,
    applicationState: (s(row.application_state) || null) as ApplicationState | null,
    companyIndustry: s(row.company_industry) || null,
    companyStage: s(row.company_stage) || null,
  };
}

export async function getJobDetailForUser(userId: string, jobId: string): Promise<JobListItem | null> {
  const row = await get<Row>(
    `SELECT j.*, m.overall_score, m.skill_score, m.education_score, m.experience_score, m.career_score,
      m.location_score, m.salary_score, m.flexibility_score, m.freshness_score, m.strengths, m.gaps,
      m.missing_requirements, m.disqualifiers, m.explanation, m.recommended_action, m.qualified, m.role_family,
      m.ai_summary, s.state as saved_state, a.id as application_id, a.state as application_state,
      c.industry as company_industry, c.stage as company_stage
     FROM jobs j JOIN job_matches m ON m.job_id = j.id AND m.user_id = ?
     LEFT JOIN saved_jobs s ON s.job_id = j.id AND s.user_id = m.user_id
     LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = m.user_id
     LEFT JOIN companies c ON c.id = j.company_id
     WHERE j.id = ?`,
    [userId, jobId],
  );
  return row ? await mapJobListItem(row) : null;
}

export async function saveJobState(userId: string, jobId: string, state: "saved" | "shortlisted" | null): Promise<void> {
  if (!state) {
    await run("DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?", [userId, jobId]);
    return;
  }
  const existing = await get<{ id: string }>("SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?", [userId, jobId]);
  if (existing) await run("UPDATE saved_jobs SET state = ? WHERE id = ?", [state, existing.id]);
  else await run("INSERT INTO saved_jobs (id, user_id, job_id, state, created_at) VALUES (?, ?, ?, ?, ?)", [newId("sav"), userId, jobId, state, nowIso()]);
}

export interface ApplicationListItem {
  id: string;
  state: ApplicationState;
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  applicationUrl: string;
  applicationMethod: string;
  matchScore: number | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  approvedAt: string | null;
  approvalRequired: boolean;
  notes: string | null;
  salaryText: string | null;
  remoteStatus: string;
  resumeVersionId: string | null;
  coverLetterId: string | null;
  lastEvent: string | null;
  documentCount: number;
}

export async function getApplications(userId: string, filters: { state?: string; query?: string; limit?: number } = {}): Promise<ApplicationListItem[]> {
  const where = ["a.user_id = ?"];
  const params: (string | number)[] = [userId];
  if (filters.state) { where.push("a.state = ?"); params.push(filters.state); }
  if (filters.query) {
    where.push("(j.title LIKE ? OR j.company_name LIKE ?)");
    params.push(`%${filters.query}%`, `%${filters.query}%`);
  }
  const rows = await all<Row>(
    `SELECT a.*, j.title as job_title, j.company_name, j.location, j.application_url, j.application_method as job_method,
      j.salary_text, j.remote_status,
      (SELECT COUNT(*) FROM application_documents d WHERE d.application_id = a.id) as document_count,
      (SELECT e.detail FROM application_events e WHERE e.application_id = a.id ORDER BY e.created_at DESC LIMIT 1) as last_event
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE ${where.join(" AND ")}
     ORDER BY a.updated_at DESC LIMIT ?`,
    [...params, filters.limit ?? 200],
  );
  return rows.map((row) => ({
    id: s(row.id),
    state: s(row.state) as ApplicationState,
    jobId: s(row.job_id),
    jobTitle: s(row.job_title),
    company: s(row.company_name),
    location: s(row.location),
    applicationUrl: s(row.application_url),
    applicationMethod: s(row.job_method, "external"),
    matchScore: nullableNum(row.match_score),
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
    appliedAt: s(row.applied_at) || null,
    approvedAt: s(row.approved_at) || null,
    approvalRequired: n(row.approval_required) === 1,
    notes: s(row.notes) || null,
    salaryText: s(row.salary_text) || null,
    remoteStatus: s(row.remote_status),
    resumeVersionId: s(row.resume_version_id) || null,
    coverLetterId: s(row.cover_letter_id) || null,
    lastEvent: s(row.last_event) || null,
    documentCount: n(row.document_count),
  }));
}

export async function getApplicationDetail(userId: string, applicationId: string) {
  const row = await get<Row>(
    `SELECT a.*, j.title as job_title, j.company_name, j.description as job_description, j.location, j.application_url,
      j.application_method as job_method, j.salary_text, j.remote_status, j.employment_type, j.skills_required,
      j.company_website, j.career_page_url
     FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND a.user_id = ?`,
    [applicationId, userId],
  );
  if (!row) return null;
  const match = await get<Row>("SELECT * FROM job_matches WHERE user_id = ? AND job_id = ?", [userId, s(row.job_id)]);
  const documents = await all<Row>("SELECT * FROM application_documents WHERE application_id = ? ORDER BY created_at DESC", [applicationId]);
  const questions = await all<Row>("SELECT * FROM application_questions WHERE application_id = ? ORDER BY created_at", [applicationId]);
  const events = await all<Row>("SELECT * FROM application_events WHERE application_id = ? ORDER BY created_at DESC", [applicationId]);
  const resume = row.resume_version_id ? await get<Row>("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?", [s(row.resume_version_id), userId]) : undefined;
  const cover = row.cover_letter_id ? await get<Row>("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?", [s(row.cover_letter_id), userId]) : undefined;
  const email = row.recruiter_email_id ? await get<Row>("SELECT * FROM email_messages WHERE id = ? AND user_id = ?", [s(row.recruiter_email_id), userId]) : undefined;
  const browserTasks = await all<Row>("SELECT * FROM automation_tasks WHERE user_id = ? AND type = 'browser-apply' ORDER BY created_at DESC LIMIT 25", [userId]);
  const browserTask = browserTasks.find((task) => {
    const payload = parseJson<Record<string, unknown>>(task.payload, {});
    return payload.applicationId === applicationId;
  });
  return {
    application: {
      id: s(row.id), state: s(row.state) as ApplicationState, jobId: s(row.job_id), companyId: s(row.company_id) || null,
      matchScore: nullableNum(row.match_score), method: s(row.application_method, "external"), approvalRequired: n(row.approval_required) === 1,
      approvedAt: s(row.approved_at) || null, appliedAt: s(row.applied_at) || null, createdAt: s(row.created_at),
      updatedAt: s(row.updated_at), notes: s(row.notes) || null, autonomyLevel: n(row.autonomy_level, 3),
    },
    job: {
      id: s(row.job_id), title: s(row.job_title), company: s(row.company_name), description: s(row.job_description),
      location: s(row.location), applicationUrl: s(row.application_url), method: s(row.job_method, "external"),
      salaryText: s(row.salary_text) || null, remoteStatus: s(row.remote_status), employmentType: s(row.employment_type),
      skills: parseJson<string[]>(s(row.skills_required, "[]"), []), website: s(row.company_website) || null,
      careerPageUrl: s(row.career_page_url) || null,
    },
    match: match ? {
      overallScore: n(match.overall_score), explanation: s(match.explanation), strengths: parseJson<string[]>(s(match.strengths, "[]"), []),
      gaps: parseJson<string[]>(s(match.gaps, "[]"), []), recommendedAction: s(match.recommended_action),
    } : null,
    documents: documents.map((d) => ({ id: s(d.id), kind: s(d.kind), filename: s(d.filename), path: s(d.path), createdAt: s(d.created_at) })),
    questions: questions.map((q) => ({ id: s(q.id), question: s(q.question), answer: s(q.answer), requiresApproval: n(q.requires_approval) === 1, sensitive: n(q.sensitive) === 1, status: s(q.status) })),
    events: events.map((e) => ({ id: s(e.id), type: s(e.event_type), from: s(e.from_state) || null, to: s(e.to_state) || null, detail: s(e.detail), createdAt: s(e.created_at) })),
    resume: resume ? { id: s(resume.id), title: s(resume.title), content: parseJson<Record<string, unknown>>(s(resume.content_json, "{}"), {}), pdf: s(resume.file_pdf_path) || null, docx: s(resume.file_docx_path) || null, notes: parseJson<string[]>(s(resume.customization_notes, "[]"), []) } : null,
    coverLetter: cover ? { id: s(cover.id), title: s(cover.title), content: parseJson<Record<string, unknown>>(s(cover.content_json, "{}"), {}), pdf: s(cover.file_pdf_path) || null, docx: s(cover.file_docx_path) || null } : null,
    email: email ? { id: s(email.id), to: s(email.to_email), subject: s(email.subject), body: s(email.body), status: s(email.status), error: s(email.error) || null } : null,
    automation: browserTask ? {
      id: s(browserTask.id),
      status: s(browserTask.status),
      attempts: n(browserTask.attempts),
      maxAttempts: n(browserTask.max_attempts, 3),
      lastError: s(browserTask.last_error) || null,
      nextRunAt: s(browserTask.next_run_at) || null,
      updatedAt: s(browserTask.updated_at) || null,
    } : null,
  };
}

export async function getApplicationById(userId: string, id: string): Promise<Row | undefined> {
  return await get<Row>("SELECT * FROM applications WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function addApplicationEvent(userId: string, applicationId: string, type: string, from: string | null, to: string | null, detail: string): Promise<void> {
  await run(
    "INSERT INTO application_events (id, application_id, user_id, event_type, from_state, to_state, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [newId("evt"), applicationId, userId, type, from, to, detail, nowIso()],
  );
}

export async function getResumeVersions(userId: string, limit = 50) {
  return (await all<Row>("SELECT * FROM resume_versions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [userId, limit])).map((r) => ({
    id: s(r.id), title: s(r.title), kind: s(r.kind), jobId: s(r.job_id) || null, provider: s(r.provider),
    atsKeywords: parseJson<string[]>(s(r.ats_keywords, "[]"), []),
    notes: parseJson<string[]>(s(r.customization_notes, "[]"), []),
    pdf: s(r.file_pdf_path) || null, docx: s(r.file_docx_path) || null, createdAt: s(r.created_at),
  }));
}

export async function getUploadedResumes(userId: string) {
  return (await all<Row>("SELECT * FROM uploaded_resumes WHERE user_id = ? ORDER BY created_at DESC", [userId])).map((r) => ({
    id: s(r.id), filename: s(r.filename), mimeType: s(r.mime_type), size: n(r.size), status: s(r.parse_status),
    error: s(r.parse_error) || null, createdAt: s(r.created_at), path: s(r.storage_path),
  }));
}

export async function getNotifications(userId: string, limit = 30) {
  return (await all<Row>("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [userId, limit])).map((r) => ({
    id: s(r.id), type: s(r.type), title: s(r.title), body: s(r.body), readAt: s(r.read_at) || null,
    actionUrl: s(r.action_url) || null, createdAt: s(r.created_at),
  }));
}

export async function createNotification(userId: string, type: string, title: string, body: string, actionUrl?: string): Promise<void> {
  await run("INSERT INTO notifications (id, user_id, type, title, body, action_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    newId("ntf"), userId, type, title, body, actionUrl ?? null, nowIso(),
  ]);
  // Best-effort transactional email (Resend). Fire-and-forget; never blocks.
  void import("./transactional-email").then((m) => m.emailNotification(userId, title, body, actionUrl)).catch(() => {});
}

export async function markNotificationsRead(userId: string, id?: string): Promise<void> {
  if (id) await run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL", [nowIso(), id, userId]);
  else await run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [nowIso(), userId]);
}

export async function getCompanies(userId: string, filters: { query?: string; stage?: string; industry?: string; tracked?: boolean; limit?: number } = {}) {
  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (filters.query) { where.push("(c.name LIKE ? OR c.industry LIKE ? OR c.description LIKE ?)"); const q = `%${filters.query}%`; params.push(q, q, q); }
  if (filters.stage) { where.push("c.stage = ?"); params.push(filters.stage); }
  if (filters.industry) { where.push("c.industry LIKE ?"); params.push(`%${filters.industry}%`); }
  if (filters.tracked) where.push("t.id IS NOT NULL");
  const rows = await all<Row>(
    `SELECT c.*, t.id as target_id, t.status as target_status,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.status = 'active') as open_jobs,
      (SELECT COUNT(*) FROM company_contacts cc WHERE cc.company_id = c.id) as contact_count
     FROM companies c LEFT JOIN company_targets t ON t.company_id = c.id AND t.user_id = ?
     WHERE ${where.join(" AND ")} ORDER BY c.verified DESC, c.name LIMIT ?`,
    [userId, ...params, filters.limit ?? 100],
  );
  return rows.map((r) => ({
    id: s(r.id), name: s(r.name), slug: s(r.slug), website: s(r.website) || null, careersUrl: s(r.careers_url) || null,
    industry: s(r.industry) || null, location: s(r.location) || null, size: s(r.size) || null, stage: s(r.stage) || null,
    description: s(r.description) || null, verified: n(r.verified) === 1, source: s(r.source),
    openJobs: n(r.open_jobs), contactCount: n(r.contact_count), tracked: !!s(r.target_id), targetStatus: s(r.target_status) || null,
    updatedAt: s(r.updated_at),
  }));
}

export async function trackCompany(userId: string, companyId: string, status: string): Promise<void> {
  const existing = await get<{ id: string }>("SELECT id FROM company_targets WHERE user_id = ? AND company_id = ?", [userId, companyId]);
  if (existing) await run("UPDATE company_targets SET status = ? WHERE id = ?", [status, existing.id]);
  else await run("INSERT INTO company_targets (id, user_id, company_id, status, created_at) VALUES (?, ?, ?, ?, ?)", [newId("tgt"), userId, companyId, status, nowIso()]);
}

export async function getDashboard(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();

  // Run all independent queries in parallel instead of sequentially.
  const [
    statsRow,
    pipeline,
    topMatchesResult,
    recentApplicationsRaw,
    events,
    logs,
    followUpRows,
    weeklyRows,
    notifications,
  ] = await Promise.all([
    // Single aggregated stats query instead of 9 separate COUNT queries.
    get<Record<string, unknown>>(
      `SELECT
        (SELECT COUNT(*) FROM job_matches WHERE user_id = ?) AS discovered,
        (SELECT COUNT(*) FROM job_matches WHERE user_id = ? AND overall_score >= 50) AS matched,
        (SELECT COUNT(*) FROM saved_jobs WHERE user_id = ? AND state = 'shortlisted') AS shortlisted,
        (SELECT COUNT(*) FROM applications WHERE user_id = ? AND applied_at IS NOT NULL) AS applied,
        (SELECT COUNT(*) FROM applications WHERE user_id = ? AND state IN ('Awaiting Approval','Draft Ready')) AS pending,
        (SELECT COUNT(*) FROM applications WHERE user_id = ? AND state IN ('Interview','Assessment')) AS interviews,
        (SELECT COUNT(*) FROM applications WHERE user_id = ? AND state IN ('Interview','Assessment','Offer','Rejected')) AS responses,
        (SELECT COUNT(*) FROM applications WHERE user_id = ?) AS total_applications,
        (SELECT COUNT(*) FROM job_matches WHERE user_id = ? AND created_at >= ?) AS new_this_week`,
      [userId, userId, userId, userId, userId, userId, userId, userId, userId, weekAgo],
    ),
    all<{ state: string; c: number }>("SELECT state, COUNT(*) as c FROM applications WHERE user_id = ? GROUP BY state", [userId]),
    getJobsForUser(userId, { minScore: 40, limit: 5, sort: "match" }),
    getApplications(userId, { limit: 5 }),
    all<Row>(
      `SELECT e.*, a.job_id, j.title, j.company_name FROM application_events e
       JOIN applications a ON a.id = e.application_id JOIN jobs j ON j.id = a.job_id
       WHERE e.user_id = ? ORDER BY e.created_at DESC LIMIT 8`,
      [userId],
    ),
    all<Row>("SELECT * FROM automation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 8", [userId]),
    all<Row>(
      `SELECT a.*, j.title, j.company_name FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.user_id = ? AND a.state = 'Applied' AND a.applied_at IS NOT NULL AND a.applied_at <= ?
       ORDER BY a.applied_at ASC LIMIT 5`,
      [userId, fiveDaysAgo],
    ),
    all<Row>("SELECT created_at FROM applications WHERE user_id = ? AND created_at >= ?", [userId, eightWeeksAgo]),
    getNotifications(userId, 8),
  ]);

  const discovered = Number(statsRow?.discovered ?? 0);
  const matched = Number(statsRow?.matched ?? 0);
  const shortlisted = Number(statsRow?.shortlisted ?? 0);
  const applied = Number(statsRow?.applied ?? 0);
  const pending = Number(statsRow?.pending ?? 0);
  const interviews = Number(statsRow?.interviews ?? 0);
  const responses = Number(statsRow?.responses ?? 0);
  const totalApplications = Number(statsRow?.total_applications ?? 0);
  const newThisWeek = Number(statsRow?.new_this_week ?? 0);

  const topMatches = topMatchesResult.items;
  const recentApplications = recentApplicationsRaw;
  const activity = [
    ...events.map((e) => ({ id: s(e.id), kind: "application" as const, title: s(e.event_type).replace(/_/g, " "), body: `${s(e.title)} · ${s(e.company_name)}${s(e.to_state) ? ` → ${s(e.to_state)}` : ""}`, at: s(e.created_at), href: `/applications/${s(e.application_id)}` })),
    ...logs.map((l) => ({ id: s(l.id), kind: "automation" as const, title: s(l.level), body: s(l.message), at: s(l.created_at), href: "/automation" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  const followUps = followUpRows.map((r) => ({ id: s(r.id), title: s(r.title), company: s(r.company_name), appliedAt: s(r.applied_at), daysAgo: Math.floor((Date.now() - new Date(s(r.applied_at)).getTime()) / 86400000) }));
  const weekly = Array.from({ length: 8 }, (_, index) => ({ week: index, count: 0, label: "" }));
  const now = Date.now();
  for (const row of weeklyRows) {
    const age = now - new Date(s(row.created_at)).getTime();
    const bucket = 7 - Math.min(7, Math.floor(age / (7 * 86400000)));
    if (bucket >= 0 && bucket < weekly.length) weekly[bucket].count += 1;
  }
  for (let index = 0; index < weekly.length; index++) {
    const start = new Date(now - (7 - index) * 7 * 86400000);
    weekly[index].label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const funnel = [
    { label: "Discovered", value: discovered },
    { label: "Matched", value: matched },
    { label: "Shortlisted", value: shortlisted },
    { label: "Drafted", value: totalApplications },
    { label: "Applied", value: applied },
    { label: "Interview", value: interviews },
  ];
  return {
    stats: {
      discovered, matched, shortlisted, applied, pending, interviews, newThisWeek, totalApplications,
      responseRate: applied ? Math.round((responses / applied) * 100) : 0,
    },
    funnel,
    weekly,
    pipeline,
    topMatches,
    recentApplications,
    activity,
    followUps,
    notifications,
  };
}

export async function getSources() {
  return (await all<Row>("SELECT * FROM job_sources ORDER BY category, name")).map((r) => ({
    key: s(r.key), name: s(r.name), category: s(r.category), enabled: n(r.enabled) === 1,
    status: s(r.status), lastRunAt: s(r.last_run_at) || null, lastError: s(r.last_error) || null,
    reliability: n(r.reliability), config: parseJson<Record<string, unknown>>(s(r.config, "{}"), {}),
  }));
}

export async function getAutomationOverview(userId: string) {
  const tasks = (await all<Row>("SELECT * FROM automation_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 30", [userId])).map((r) => ({
    id: s(r.id), type: s(r.type), status: s(r.status), attempts: n(r.attempts), maxAttempts: n(r.max_attempts),
    nextRunAt: s(r.next_run_at), lastError: s(r.last_error) || null, createdAt: s(r.created_at),
    payload: parseJson<Record<string, unknown>>(s(r.payload, "{}"), {}),
  }));
  const runs = (await all<Row>("SELECT * FROM automation_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 12", [userId])).map((r) => ({
    id: s(r.id), trigger: s(r.trigger), status: s(r.status), startedAt: s(r.started_at), finishedAt: s(r.finished_at) || null,
    error: s(r.error) || null, summary: parseJson<Record<string, unknown>>(s(r.summary, "{}"), {}),
  }));
  const logs = (await all<Row>("SELECT * FROM automation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 80", [userId])).map((r) => ({
    id: s(r.id), level: s(r.level), message: s(r.message), at: s(r.created_at),
    meta: parseJson<Record<string, unknown>>(s(r.meta, "{}"), {}),
  }));
  const worker = await get<Row>("SELECT * FROM worker_status WHERE id = 'playwright-worker'");
  const schedule = await get<Row>("SELECT * FROM scheduled_searches WHERE user_id = ? ORDER BY created_at LIMIT 1", [userId]);
  return {
    tasks, runs, logs,
    worker: worker ? { status: s(worker.status), lastHeartbeat: s(worker.last_heartbeat) || null, meta: parseJson<Record<string, unknown>>(s(worker.meta, "{}"), {}) } : { status: "offline", lastHeartbeat: null, meta: {} },
    schedule: schedule ? { id: s(schedule.id), name: s(schedule.name), frequency: s(schedule.frequency), hour: n(schedule.hour_local), enabled: n(schedule.enabled) === 1, lastRunAt: s(schedule.last_run_at) || null, nextRunAt: s(schedule.next_run_at) || null } : null,
  };
}

export async function getInterviewData(userId: string) {
  const applications = (await getApplications(userId, { limit: 100 })).filter((a) => ["Applied", "Interview", "Assessment", "Offer"].includes(a.state));
  const sessions = (await all<Row>("SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", [userId])).map((r) => ({
    id: s(r.id), applicationId: s(r.application_id) || null, type: s(r.type), status: s(r.status),
    questions: parseJson<unknown[]>(s(r.questions, "[]"), []), answers: parseJson<unknown[]>(s(r.answers, "[]"), []),
    feedback: s(r.feedback) || null, score: nullableNum(r.score), createdAt: s(r.created_at),
    interviewAt: s(r.interview_at) || null, interviewType: s(r.interview_type) || null,
    interviewLocation: s(r.interview_location) || null, interviewer: s(r.interviewer) || null,
  }));
  return { applications, sessions };
}

export async function getSettingsData(userId: string) {
  const integration = await get<Row>("SELECT * FROM email_integrations WHERE user_id = ?", [userId]);
  const notifications = await get<Row>("SELECT * FROM notification_preferences WHERE user_id = ?", [userId]);
  return {
    emailIntegration: integration ? {
      provider: s(integration.provider), fromEmail: s(integration.from_email) || null, host: s(integration.smtp_host) || null,
      port: nullableNum(integration.smtp_port), secure: n(integration.smtp_secure) === 1, user: s(integration.smtp_user) || null,
      configured: !!s(integration.smtp_password_enc), status: s(integration.status),
    } : { provider: "smtp", fromEmail: null, host: null, port: null, secure: false, user: null, configured: false, status: "not_configured" },
    notifications: notifications ? {
      emailEnabled: n(notifications.email_enabled) === 1, dailyDigest: n(notifications.daily_digest) === 1,
      applicationUpdates: n(notifications.application_updates) === 1, interviewReminders: n(notifications.interview_reminders) === 1,
      frequency: s(notifications.frequency),
    } : { emailEnabled: false, dailyDigest: true, applicationUpdates: true, interviewReminders: true, frequency: "daily" },
    sessions: (await all<Row>("SELECT id, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC", [userId])).map((r) => ({ id: s(r.id), createdAt: s(r.created_at), expiresAt: s(r.expires_at) })),
  };
}

export async function getCareerAnalysis(userId: string) {
  const row = await get<Row>("SELECT * FROM career_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [userId]);
  if (!row) return null;
  return { paths: parseJson<unknown[]>(s(row.paths, "[]"), []), transferableSkills: parseJson<unknown[]>(s(row.transferable_skills, "[]"), []), summary: s(row.summary), provider: s(row.provider), createdAt: s(row.created_at) };
}















