export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship"
  | "apprenticeship"
  | "trainee"
  | "temporary"
  | "unknown";

export type RemoteStatus = "remote" | "hybrid" | "onsite" | "unknown";

export type ApplicationState =
  | "Discovered"
  | "Analyzed"
  | "Shortlisted"
  | "Draft Ready"
  | "Awaiting Approval"
  | "Approved"
  | "Applying"
  | "Applied"
  | "Application Failed"
  | "Interview"
  | "Assessment"
  | "Rejected"
  | "Offer"
  | "Withdrawn";

export type ApplicationMethod = "external" | "email" | "browser" | "manual";

export type PermissionMode = "automatic" | "approval" | "never";

export interface NormalizedJob {
  id: string;
  source: string;
  sourceJobId: string;
  title: string;
  companyName: string;
  companySlug: string;
  companyWebsite?: string | null;
  careerPageUrl?: string | null;
  description: string;
  descriptionHtml?: string | null;
  location: string;
  city?: string | null;
  country: string;
  remoteStatus: RemoteStatus;
  employmentType: EmploymentType;
  experienceRequired?: string | null;
  educationRequirements?: string | null;
  skillsRequired: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryText?: string | null;
  applicationUrl: string;
  applicationMethod: ApplicationMethod;
  postedAt?: string | null;
  lastVerifiedAt: string;
  status: "active" | "expired" | "unverified";
  reliability: number;
  fingerprint: string;
  raw?: unknown;
}

export interface CandidateSkill {
  id?: string;
  name: string;
  category?: string | null;
  proficiency?: string | null;
  years?: number | null;
  source?: string | null;
}

export interface CandidateExperience {
  role: string;
  company: string;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  description: string;
  highlights?: string[];
}

export interface CandidateProject {
  name: string;
  description: string;
  technologies?: string[];
  link?: string | null;
}

export interface CandidateEducation {
  degree: string;
  field?: string | null;
  university: string;
  graduationYear?: string | null;
  score?: string | null;
}

export interface CandidateProfile {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  headline: string;
  summary: string;
  degree: string;
  university: string;
  graduationYear: string;
  cgpa: string;
  experienceYears: number;
  currentStatus: string;
  noticePeriod: string;
  languages: string[];
  skills: CandidateSkill[];
  experience: CandidateExperience[];
  internships: CandidateExperience[];
  projects: CandidateProject[];
  certifications: string[];
  education: CandidateEducation[];
  rawCvText: string;
}

export interface MatchWeights {
  skills: number;
  education: number;
  experience: number;
  career: number;
  location: number;
  salary: number;
  flexibility: number;
  freshness: number;
}

export interface CandidatePreferences {
  targetRoles: string[];
  experienceLevels: string[];
  employmentTypes: string[];
  workModes: string[];
  preferredLocations: string[];
  allIndia: boolean;
  remoteIndia: boolean;
  internationalRemote: boolean;
  minSalaryLpa: number | null;
  salaryFlexible: boolean;
  unpaidInternship: boolean;
  paidInternship: boolean;
  industries: string[];
  flexibility: {
    anyIndustry: boolean;
    anyRole: boolean;
    willingToLearn: boolean;
    willingToRelocate: boolean;
    willingToRemote: boolean;
    entryLevel: boolean;
    startups: boolean;
    nonCore: boolean;
  };
  matchWeights: MatchWeights;
}

export interface JobMatchResult {
  overallScore: number;
  skillScore: number;
  educationScore: number;
  experienceScore: number;
  careerScore: number;
  locationScore: number;
  salaryScore: number;
  flexibilityScore: number;
  freshnessScore: number;
  strengths: string[];
  gaps: string[];
  missingRequirements: string[];
  explanation: string;
  recommendedAction: string;
  qualified: boolean;
  disqualifiers: string[];
  roleFamily: string;
  semanticSummary?: string | null;
}

export interface ResumeContent {
  header: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  skills: string[];
  experience: CandidateExperience[];
  internships: CandidateExperience[];
  projects: CandidateProject[];
  education: CandidateEducation[];
  certifications: string[];
  languages: string[];
  targetRole: string;
  company: string;
}

export interface CoverLetterContent {
  text: string;
  targetRole: string;
  company: string;
  tone: string;
}

export interface RecruiterEmailDraft {
  to: string;
  subject: string;
  body: string;
  source: "verified_public" | "user_provided" | "none";
}

export interface ApplicationQuestionDraft {
  question: string;
  answer: string;
  requiresApproval: boolean;
  sensitive: boolean;
}

export interface TailoredPackage {
  resume: ResumeContent;
  coverLetter: CoverLetterContent;
  recruiterEmail: RecruiterEmailDraft;
  questions: ApplicationQuestionDraft[];
  atsKeywords: string[];
  customizationNotes: string[];
  provider: "ai" | "deterministic";
}

export interface ParsedCv {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  degree: string;
  university: string;
  graduationYear: string;
  cgpa: string;
  skills: string[];
  projects: CandidateProject[];
  internships: CandidateExperience[];
  experience: CandidateExperience[];
  certifications: string[];
  languages: string[];
  summary: string;
  rawText: string;
}

export interface SourceMeta {
  key: string;
  name: string;
  category: "ats" | "remote-board" | "indian-portal" | "manual" | "career-page";
  description: string;
  available: boolean;
  reason?: string;
  docsUrl?: string;
  fallbackUrl?: string;
  reliability: number;
  enabled: boolean;
  requiresCredentials?: boolean;
}

export interface SourceFetchContext {
  limit?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface SourceFetchResult {
  jobs: NormalizedJob[];
  errors: string[];
  unavailable?: string;
  skipped?: number;
}

export interface JobSourceAdapter {
  meta: SourceMeta;
  fetchJobs(ctx?: SourceFetchContext): Promise<SourceFetchResult>;
}

export interface DashboardStats {
  discovered: number;
  matched: number;
  applied: number;
  pendingApproval: number;
  interviews: number;
  responseRate: number;
  shortlisted: number;
  newThisWeek: number;
}
