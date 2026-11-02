import type { ApplicationState, PermissionMode } from "./types";

export type AutonomyLevel = 1 | 2 | 3 | 4;

export interface UserPermissions {
  autonomyLevel: AutonomyLevel;
  searchJobs: PermissionMode;
  analyzeJobs: PermissionMode;
  matchJobs: PermissionMode;
  generateResumes: PermissionMode;
  generateCoverLetters: PermissionMode;
  saveDrafts: PermissionMode;
  submitApplications: PermissionMode;
  sendRecruiterEmails: PermissionMode;
  answerSensitiveQuestions: PermissionMode;
  acceptOffers: "never";
  sharePersonalInfo: PermissionMode;
  autoApplyCategories: string[];
  autoApplyMinScore: number;
  allowDuplicateApplications: boolean;
  demoMode: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  autonomyLevel: 3,
  searchJobs: "automatic",
  analyzeJobs: "automatic",
  matchJobs: "automatic",
  generateResumes: "automatic",
  generateCoverLetters: "automatic",
  saveDrafts: "automatic",
  submitApplications: "approval",
  sendRecruiterEmails: "approval",
  answerSensitiveQuestions: "approval",
  acceptOffers: "never",
  sharePersonalInfo: "approval",
  autoApplyCategories: [],
  autoApplyMinScore: 85,
  allowDuplicateApplications: false,
  demoMode: true,
};

export type PermissionAction =
  | "search_jobs"
  | "analyze_jobs"
  | "match_jobs"
  | "generate_resume"
  | "generate_cover_letter"
  | "save_draft"
  | "submit_application"
  | "send_recruiter_email"
  | "answer_sensitive_question"
  | "accept_offer"
  | "share_personal_info"
  | "auto_apply";

export interface PermissionDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

const MODE_KEYS: Record<PermissionAction, keyof UserPermissions | null> = {
  search_jobs: "searchJobs",
  analyze_jobs: "analyzeJobs",
  match_jobs: "matchJobs",
  generate_resume: "generateResumes",
  generate_cover_letter: "generateCoverLetters",
  save_draft: "saveDrafts",
  submit_application: "submitApplications",
  send_recruiter_email: "sendRecruiterEmails",
  answer_sensitive_question: "answerSensitiveQuestions",
  accept_offer: null,
  share_personal_info: "sharePersonalInfo",
  auto_apply: "submitApplications",
};

const MIN_LEVEL: Record<PermissionAction, number> = {
  search_jobs: 1,
  analyze_jobs: 1,
  match_jobs: 1,
  generate_resume: 2,
  generate_cover_letter: 2,
  save_draft: 2,
  submit_application: 3,
  send_recruiter_email: 3,
  answer_sensitive_question: 3,
  accept_offer: 5, // never reachable
  share_personal_info: 3,
  auto_apply: 4,
};

export function evaluatePermission(permissions: UserPermissions, action: PermissionAction): PermissionDecision {
  if (action === "accept_offer") {
    return { allowed: false, requiresApproval: false, reason: "JobPilot never accepts offers or signs contracts on your behalf." };
  }
  if (permissions.autonomyLevel < MIN_LEVEL[action]) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `This action requires autonomy level ${MIN_LEVEL[action]}. Your current level is ${permissions.autonomyLevel}.`,
    };
  }
  const key = MODE_KEYS[action];
  if (!key) return { allowed: false, requiresApproval: false, reason: "Action is not permitted." };
  const mode = permissions[key] as PermissionMode;
  if (mode === "never") {
    return { allowed: false, requiresApproval: false, reason: "This action is disabled in your automation permissions." };
  }
  if (mode === "approval") {
    return { allowed: true, requiresApproval: true, reason: "Your permission settings require explicit approval for this action." };
  }
  if (action === "auto_apply" && permissions.autonomyLevel < 4) {
    return { allowed: false, requiresApproval: true, reason: "Automatic applications require autonomy level 4." };
  }
  return { allowed: true, requiresApproval: false, reason: "Allowed by your automation permissions." };
}

export class PermissionError extends Error {
  action: PermissionAction;
  constructor(action: PermissionAction, message: string) {
    super(message);
    this.name = "PermissionError";
    this.action = action;
  }
}

export function assertPermission(permissions: UserPermissions, action: PermissionAction): void {
  const decision = evaluatePermission(permissions, action);
  if (!decision.allowed) throw new PermissionError(action, decision.reason);
}

export const AUTONOMY_LEVELS: { level: AutonomyLevel; name: string; description: string }[] = [
  { level: 1, name: "Discovery only", description: "Find and analyze jobs. Nothing is prepared or submitted." },
  { level: 2, name: "Discover + prepare", description: "Create tailored resumes, cover letters and drafts for your review." },
  { level: 3, name: "Apply with approval", description: "Prepare applications and submit only after you approve each one. Recommended." },
  { level: 4, name: "Rule-based auto-apply", description: "Automatically apply to pre-approved categories above your score threshold. Offers and contracts still require you." },
];

const TRANSITIONS: Record<ApplicationState, ApplicationState[]> = {
  Discovered: ["Analyzed", "Shortlisted", "Withdrawn"],
  Analyzed: ["Shortlisted", "Draft Ready", "Withdrawn"],
  Shortlisted: ["Draft Ready", "Awaiting Approval", "Withdrawn"],
  "Draft Ready": ["Awaiting Approval", "Approved", "Withdrawn"],
  "Awaiting Approval": ["Approved", "Draft Ready", "Withdrawn"],
  Approved: ["Applying", "Applied", "Application Failed", "Withdrawn"],
  Applying: ["Applied", "Application Failed", "Approved"],
  Applied: ["Interview", "Assessment", "Rejected", "Offer", "Withdrawn"],
  "Application Failed": ["Applying", "Approved", "Withdrawn"],
  Interview: ["Assessment", "Rejected", "Offer", "Withdrawn"],
  Assessment: ["Interview", "Rejected", "Offer", "Withdrawn"],
  Rejected: [],
  Offer: ["Withdrawn"],
  Withdrawn: [],
};

export function canTransition(from: ApplicationState, to: ApplicationState): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: ApplicationState, to: ApplicationState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid application state transition: ${from} → ${to}`);
  }
}

export function nextStates(from: ApplicationState): ApplicationState[] {
  return TRANSITIONS[from] ?? [];
}

export const APPLICATION_STATES: ApplicationState[] = [
  "Discovered", "Analyzed", "Shortlisted", "Draft Ready", "Awaiting Approval", "Approved",
  "Applying", "Applied", "Application Failed", "Interview", "Assessment", "Rejected", "Offer", "Withdrawn",
];

/** States that count as an application submitted to an employer. */
export const SUBMITTED_STATES: ApplicationState[] = ["Applied", "Interview", "Assessment", "Rejected", "Offer"];
