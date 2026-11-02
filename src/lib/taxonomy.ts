import type { CandidateProfile, CandidatePreferences, JobMatchResult, NormalizedJob } from "./types";

export interface SkillDefinition {
  name: string;
  category: string;
  aliases: string[];
}

/**
 * Curated skill taxonomy. Aliases are matched case-insensitively on word
 * boundaries. Keep short/ambiguous tokens out of aliases to avoid false hits.
 */
export const SKILLS: SkillDefinition[] = [
  // Automotive / mechanical
  { name: "Automotive Engineering", category: "Automotive", aliases: ["automotive engineering", "automobile engineering", "automotive technology"] },
  { name: "Vehicle Dynamics", category: "Automotive", aliases: ["vehicle dynamics", "ride and handling", "suspension design"] },
  { name: "Powertrain", category: "Automotive", aliases: ["powertrain", "power train", "drivetrain", "driveline"] },
  { name: "IC Engines", category: "Automotive", aliases: ["ic engine", "ic engines", "internal combustion", "engine calibration", "engine design"] },
  { name: "EV Technology", category: "Automotive", aliases: ["electric vehicle", "electric vehicles", "ev technology", "battery management system", "bms", "ev powertrain", "charging infrastructure"] },
  { name: "Battery Systems", category: "Automotive", aliases: ["battery systems", "battery pack", "battery design", "cell chemistry", "lithium-ion"] },
  { name: "CAD", category: "Design", aliases: ["cad", "computer aided design", "computer-aided design"] },
  { name: "SolidWorks", category: "Design", aliases: ["solidworks", "solid works"] },
  { name: "CATIA", category: "Design", aliases: ["catia"] },
  { name: "AutoCAD", category: "Design", aliases: ["autocad", "auto cad"] },
  { name: "Creo", category: "Design", aliases: ["creo", "pro/engineer", "pro engineer"] },
  { name: "NX", category: "Design", aliases: ["siemens nx", "unigraphics"] },
  { name: "GD&T", category: "Design", aliases: ["gd&t", "gd and t", "geometric dimensioning", "geometric tolerancing"] },
  { name: "FEA", category: "Design", aliases: ["fea", "finite element analysis", "structural analysis"] },
  { name: "CFD", category: "Design", aliases: ["cfd", "computational fluid dynamics"] },
  { name: "MATLAB", category: "Engineering Tools", aliases: ["matlab"] },
  { name: "Simulink", category: "Engineering Tools", aliases: ["simulink"] },
  { name: "ANSYS", category: "Engineering Tools", aliases: ["ansys"] },
  { name: "Abaqus", category: "Engineering Tools", aliases: ["abaqus"] },
  { name: "Manufacturing", category: "Manufacturing", aliases: ["manufacturing", "manufacturing engineering", "production engineering"] },
  { name: "Production Planning", category: "Manufacturing", aliases: ["production planning", "production scheduling", "shop floor", "line balancing"] },
  { name: "Quality Control", category: "Quality", aliases: ["quality control", "quality assurance", "qa/qc", "qc", "inspection", "quality engineering"] },
  { name: "Six Sigma", category: "Quality", aliases: ["six sigma", "dmaic"] },
  { name: "Lean Manufacturing", category: "Manufacturing", aliases: ["lean manufacturing", "lean", "kaizen", "5s", "value stream mapping"] },
  { name: "ISO Standards", category: "Quality", aliases: ["iso 9001", "iatf 16949", "iso/ts", "iso standards", "iso 14001"] },
  { name: "Maintenance", category: "Manufacturing", aliases: ["preventive maintenance", "predictive maintenance", "maintenance engineering", "tpm"] },
  { name: "Supply Chain", category: "Operations", aliases: ["supply chain", "supply-chain", "supply planning"] },
  { name: "Procurement", category: "Operations", aliases: ["procurement", "purchasing", "sourcing", "vendor management"] },
  { name: "Logistics", category: "Operations", aliases: ["logistics", "warehouse", "inventory management", "distribution"] },
  { name: "Project Management", category: "Business", aliases: ["project management", "project coordination", "program management", "pmp", "stakeholder management"] },
  { name: "Operations", category: "Operations", aliases: ["business operations", "operations management", "operations executive", "process improvement"] },
  { name: "PLC", category: "Automation", aliases: ["plc", "programmable logic controller", "ladder logic"] },
  { name: "SCADA", category: "Automation", aliases: ["scada", "hmi"] },
  { name: "Robotics", category: "Automation", aliases: ["robotics", "robot programming", "cobot"] },
  { name: "Embedded Systems", category: "Automation", aliases: ["embedded systems", "embedded c", "microcontroller", "arduino", "raspberry pi"] },
  { name: "IoT", category: "Automation", aliases: ["internet of things", "iot"] },
  { name: "Mechatronics", category: "Automation", aliases: ["mechatronics"] },

  // Software / data
  { name: "Python", category: "Programming", aliases: ["python"] },
  { name: "Java", category: "Programming", aliases: ["java"] },
  { name: "JavaScript", category: "Programming", aliases: ["javascript", "js"] },
  { name: "TypeScript", category: "Programming", aliases: ["typescript"] },
  { name: "C++", category: "Programming", aliases: ["c++", "cpp"] },
  { name: "C#", category: "Programming", aliases: ["c#", ".net"] },
  { name: "Go", category: "Programming", aliases: ["golang"] },
  { name: "React", category: "Web", aliases: ["react", "react.js", "reactjs"] },
  { name: "Next.js", category: "Web", aliases: ["next.js", "nextjs"] },
  { name: "Node.js", category: "Web", aliases: ["node.js", "nodejs", "node js"] },
  { name: "HTML", category: "Web", aliases: ["html", "html5"] },
  { name: "CSS", category: "Web", aliases: ["css", "css3", "tailwind"] },
  { name: "REST APIs", category: "Web", aliases: ["rest api", "restful", "rest apis", "api development"] },
  { name: "SQL", category: "Data", aliases: ["sql", "mysql", "postgresql", "postgres"] },
  { name: "NoSQL", category: "Data", aliases: ["mongodb", "nosql", "redis"] },
  { name: "Excel", category: "Data", aliases: ["excel", "advanced excel", "spreadsheets", "vlookup", "pivot tables"] },
  { name: "Power BI", category: "Data", aliases: ["power bi", "powerbi"] },
  { name: "Tableau", category: "Data", aliases: ["tableau"] },
  { name: "Data Analysis", category: "Data", aliases: ["data analysis", "data analytics", "analytical skills", "data-driven", "data driven"] },
  { name: "Data Visualization", category: "Data", aliases: ["data visualization", "data visualisation", "dashboarding", "dashboards"] },
  { name: "Machine Learning", category: "Data", aliases: ["machine learning", "ml models", "deep learning", "scikit-learn", "tensorflow", "pytorch"] },
  { name: "Statistics", category: "Data", aliases: ["statistics", "statistical analysis", "regression analysis", "hypothesis testing"] },
  { name: "Git", category: "Engineering Tools", aliases: ["git", "github", "gitlab", "version control"] },
  { name: "Linux", category: "IT", aliases: ["linux", "unix", "bash", "shell scripting"] },
  { name: "AWS", category: "Cloud", aliases: ["aws", "amazon web services"] },
  { name: "Azure", category: "Cloud", aliases: ["azure"] },
  { name: "GCP", category: "Cloud", aliases: ["gcp", "google cloud"] },
  { name: "Docker", category: "Cloud", aliases: ["docker", "containerization", "kubernetes"] },
  { name: "Manual Testing", category: "Quality", aliases: ["manual testing", "test cases", "functional testing", "regression testing"] },
  { name: "Automation Testing", category: "Quality", aliases: ["automation testing", "selenium", "cypress", "playwright", "test automation"] },
  { name: "QA Engineering", category: "Quality", aliases: ["qa engineer", "quality assurance engineer", "sdet", "software tester"] },
  { name: "Technical Support", category: "Support", aliases: ["technical support", "troubleshooting", "application support", "production support", "desktop support"] },
  { name: "Networking", category: "IT", aliases: ["networking", "tcp/ip", "dns", "ccna", "network administration"] },
  { name: "System Administration", category: "IT", aliases: ["system administration", "sysadmin", "active directory", "windows server"] },
  { name: "Cybersecurity", category: "IT", aliases: ["cybersecurity", "information security", "penetration testing", "soc"] },
  { name: "Product Management", category: "Business", aliases: ["product management", "product owner", "product roadmap"] },

  // Business / support / finance / marketing
  { name: "Business Analysis", category: "Business", aliases: ["business analysis", "business analyst", "requirements gathering", "brd", "functional requirements"] },
  { name: "Business Development", category: "Sales", aliases: ["business development", "lead generation", "b2b sales", "prospecting"] },
  { name: "Sales", category: "Sales", aliases: ["sales", "inside sales", "field sales", "sales executive", "revenue targets"] },
  { name: "Customer Success", category: "Support", aliases: ["customer success", "client relationship", "account management", "customer retention"] },
  { name: "Customer Support", category: "Support", aliases: ["customer support", "customer service", "chat support", "email support", "voice process", "non-voice", "customer care"] },
  { name: "Communication", category: "Soft Skills", aliases: ["communication skills", "verbal communication", "written communication", "presentation skills", "stakeholder communication"] },
  { name: "Problem Solving", category: "Soft Skills", aliases: ["problem solving", "problem-solving", "root cause analysis", "rca", "critical thinking"] },
  { name: "Teamwork", category: "Soft Skills", aliases: ["teamwork", "team player", "collaboration", "cross-functional"] },
  { name: "Leadership", category: "Soft Skills", aliases: ["leadership", "team handling", "people management", "mentoring"] },
  { name: "Negotiation", category: "Soft Skills", aliases: ["negotiation", "negotiating"] },
  { name: "Time Management", category: "Soft Skills", aliases: ["time management", "prioritization", "multitasking"] },
  { name: "Attention to Detail", category: "Soft Skills", aliases: ["attention to detail", "detail-oriented", "detail oriented", "accuracy"] },
  { name: "CRM", category: "Sales", aliases: ["crm", "salesforce crm", "zoho crm", "hubspot"] },
  { name: "Accounting", category: "Finance", aliases: ["accounting", "bookkeeping", "general ledger", "reconciliation", "accounts payable", "accounts receivable"] },
  { name: "Tally", category: "Finance", aliases: ["tally", "tally erp"] },
  { name: "Financial Analysis", category: "Finance", aliases: ["financial analysis", "financial modeling", "budgeting", "forecasting", "variance analysis"] },
  { name: "Banking Operations", category: "Finance", aliases: ["banking operations", "kyc", "aml", "loan processing", "credit analysis"] },
  { name: "MIS Reporting", category: "Finance", aliases: ["mis", "mis reporting", "management information system", "reporting analyst"] },
  { name: "Payroll", category: "HR", aliases: ["payroll", "salary processing", "statutory compliance"] },
  { name: "Recruitment", category: "HR", aliases: ["recruitment", "talent acquisition", "sourcing candidates", "hr operations"] },
  { name: "Digital Marketing", category: "Marketing", aliases: ["digital marketing", "performance marketing", "paid campaigns", "google ads", "meta ads"] },
  { name: "SEO", category: "Marketing", aliases: ["seo", "search engine optimization", "keyword research", "on-page"] },
  { name: "Social Media Marketing", category: "Marketing", aliases: ["social media", "social media marketing", "instagram marketing", "linkedin marketing"] },
  { name: "Content Writing", category: "Marketing", aliases: ["content writing", "copywriting", "content creation", "blog writing"] },
  { name: "Graphic Design", category: "Design", aliases: ["graphic design", "photoshop", "illustrator", "canva", "adobe creative suite"] },
  { name: "Video Editing", category: "Marketing", aliases: ["video editing", "premiere pro", "after effects", "final cut"] },
  { name: "Figma", category: "Design", aliases: ["figma", "ui design", "ux design", "wireframing"] },
  { name: "Market Research", category: "Marketing", aliases: ["market research", "competitor analysis", "consumer insights"] },
];

const SKILL_ALIAS_INDEX = new Map<string, SkillDefinition>();
for (const skill of SKILLS) {
  SKILL_ALIAS_INDEX.set(skill.name.toLowerCase(), skill);
  for (const alias of skill.aliases) SKILL_ALIAS_INDEX.set(alias.toLowerCase(), skill);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Canonicalise a free-text skill. Unknown skills are title-cased and kept. */
export function canonicalSkill(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const hit = SKILL_ALIAS_INDEX.get(cleaned.toLowerCase());
  if (hit) return hit.name;
  const lower = cleaned.toLowerCase();
  for (const skill of SKILLS) {
    if (skill.aliases.some((a) => a.length > 3 && lower.includes(a))) return skill.name;
  }
  return cleaned
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function skillCategory(name: string): string {
  return SKILL_ALIAS_INDEX.get(name.toLowerCase())?.category ?? "Other";
}

/** Extract canonical skills from a job description/title. */
export function extractSkills(text: string, limit = 30): string[] {
  const haystack = text.toLowerCase();
  const found = new Map<string, number>();
  for (const skill of SKILLS) {
    for (const alias of skill.aliases) {
      if (alias.length < 2) continue;
      const re = new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(alias.toLowerCase())}([^a-z0-9+#.]|$)`, "g");
      const matches = haystack.match(re);
      if (matches) found.set(skill.name, (found.get(skill.name) ?? 0) + matches.length);
    }
  }
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export interface RoleFamily {
  key: string;
  label: string;
  titles: RegExp[];
  coreSkills: string[];
  adjacentSkills: string[];
  education: "engineering" | "any" | "commerce" | "it" | "design";
  industries: string[];
  description: string;
}

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    key: "automotive",
    label: "Automotive & EV Engineering",
    titles: [/automobile/i, /automotive/i, /vehicle/i, /powertrain/i, /chassis/i, /engine/i, /ev\b/i, /battery/i, /homologation/i, /workshop/i, /body shop/i, /paint shop/i],
    coreSkills: ["Automotive Engineering", "Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "Battery Systems", "CAD", "SolidWorks", "CATIA"],
    adjacentSkills: ["Manufacturing", "Quality Control", "Project Management", "Data Analysis"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "EV", "Mobility"],
    description: "Design, test, manufacture and service vehicles, components and EV systems.",
  },
  {
    key: "mechanical_design",
    label: "Mechanical Design & CAE",
    titles: [/mechanical/i, /design engineer/i, /cad engineer/i, /cae/i, /simulation/i, /thermal/i, /structural/i, /product design/i, /tool design/i, /r&d/i, /research and development/i],
    coreSkills: ["CAD", "SolidWorks", "CATIA", "Creo", "NX", "GD&T", "FEA", "CFD", "ANSYS", "Abaqus", "MATLAB"],
    adjacentSkills: ["Manufacturing", "Project Management", "Automotive Engineering"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "Aerospace", "Industrial Equipment"],
    description: "Turn concepts into manufacturable products using CAD, simulation and design validation.",
  },
  {
    key: "manufacturing_quality",
    label: "Manufacturing, Quality & Operations Engineering",
    titles: [/manufactur/i, /production/i, /quality/i, /maintenance/i, /plant/i, /process engineer/i, /industrial engineer/i, /supplier quality/i, /lean/i, /six sigma/i, /operations engineer/i, /safety/i],
    coreSkills: ["Manufacturing", "Production Planning", "Quality Control", "Six Sigma", "Lean Manufacturing", "ISO Standards", "Maintenance", "GD&T", "PLC", "Project Management"],
    adjacentSkills: ["Supply Chain", "Operations", "Data Analysis", "Problem Solving"],
    education: "engineering",
    industries: ["Automotive", "Manufacturing", "FMCG", "Pharma", "Electronics"],
    description: "Improve production lines, quality systems, reliability and plant performance.",
  },
  {
    key: "field_service",
    label: "Field Service & Technical Support",
    titles: [/service engineer/i, /field engineer/i, /technical support/i, /installation/i, /commissioning/i, /after[- ]sales/i, /service desk/i, /application engineer/i, /customer engineer/i],
    coreSkills: ["Technical Support", "Problem Solving", "Communication", "Maintenance", "Automotive Engineering", "Networking"],
    adjacentSkills: ["Customer Support", "Customer Success", "Operations", "Sales"],
    education: "engineering",
    industries: ["Automotive", "Industrial Equipment", "IT", "Telecom", "Energy"],
    description: "Diagnose, install and support technical products for customers in the field or remotely.",
  },
  {
    key: "software",
    label: "Software Engineering & QA",
    titles: [/software/i, /developer/i, /frontend/i, /front-end/i, /backend/i, /back-end/i, /full[- ]stack/i, /web developer/i, /qa engineer/i, /sdet/i, /software tester/i, /devops/i, /data engineer/i, /machine learning engineer/i, /ai engineer/i],
    coreSkills: ["Python", "Java", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git", "REST APIs", "Docker", "AWS", "Automation Testing", "Manual Testing"],
    adjacentSkills: ["Data Analysis", "Problem Solving", "Technical Support", "Product Management"],
    education: "it",
    industries: ["IT", "SaaS", "FinTech", "E-commerce", "Startups"],
    description: "Build, test and operate software products and platforms.",
  },
  {
    key: "data_business_analyst",
    label: "Data & Business Analysis",
    titles: [/data analyst/i, /business analyst/i, /business intelligence/i, /\bbi\b/i, /analytics/i, /mis executive/i, /data science/i, /product analyst/i, /reporting analyst/i, /insights/i],
    coreSkills: ["SQL", "Excel", "Power BI", "Tableau", "Data Analysis", "Data Visualization", "Statistics", "Python", "MIS Reporting", "Business Analysis"],
    adjacentSkills: ["Communication", "Problem Solving", "Operations", "Project Management"],
    education: "any",
    industries: ["IT", "BFSI", "E-commerce", "Consulting", "Manufacturing"],
    description: "Use data, dashboards and analysis to inform business decisions.",
  },
  {
    key: "business_operations",
    label: "Business, Sales & Operations",
    titles: [/business development/i, /sales/i, /account executive/i, /account manager/i, /customer success/i, /operations/i, /management trainee/i, /project coordinator/i, /procurement/i, /supply chain/i, /logistics/i, /process associate/i, /founder'?s office/i, /generalist/i, /strategy/i, /partnerships/i],
    coreSkills: ["Business Development", "Sales", "Operations", "Communication", "Negotiation", "Customer Success", "Supply Chain", "Procurement", "Project Management", "CRM", "Excel"],
    adjacentSkills: ["Business Analysis", "Data Analysis", "Marketing", "Leadership"],
    education: "any",
    industries: ["E-commerce", "Logistics", "Manufacturing", "SaaS", "FinTech", "Retail"],
    description: "Grow revenue, run operations and solve customer or process problems.",
  },
  {
    key: "customer_support",
    label: "Customer & Technical Support",
    titles: [/customer support/i, /customer service/i, /voice process/i, /non[- ]voice/i, /chat support/i, /email support/i, /service desk/i, /customer care/i, /support associate/i, /support executive/i, /customer experience/i],
    coreSkills: ["Customer Support", "Communication", "Problem Solving", "Technical Support", "CRM", "Attention to Detail"],
    adjacentSkills: ["Customer Success", "Operations", "Sales"],
    education: "any",
    industries: ["BPO", "IT", "E-commerce", "BFSI", "Telecom"],
    description: "Resolve customer issues across voice, chat and email channels.",
  },
  {
    key: "finance_admin",
    label: "Finance, HR & Administration",
    titles: [/finance/i, /account/i, /banking operations/i, /payroll/i, /recruit/i, /talent acquisition/i, /hr assistant/i, /human resource/i, /back office/i, /data entry/i, /office assistant/i, /administration/i, /audit/i, /tax/i],
    coreSkills: ["Accounting", "Excel", "Tally", "Financial Analysis", "Banking Operations", "MIS Reporting", "Payroll", "Recruitment", "Attention to Detail"],
    adjacentSkills: ["Data Analysis", "Operations", "Communication", "Business Analysis"],
    education: "commerce",
    industries: ["BFSI", "Consulting", "Manufacturing", "IT"],
    description: "Keep financial, people and administrative operations accurate and compliant.",
  },
  {
    key: "marketing_creative",
    label: "Marketing & Creative",
    titles: [/marketing/i, /seo/i, /social media/i, /content/i, /copywriter/i, /graphic design/i, /video edit/i, /brand/i, /performance marketing/i, /growth/i, /communications/i],
    coreSkills: ["Digital Marketing", "SEO", "Social Media Marketing", "Content Writing", "Graphic Design", "Video Editing", "Figma", "Market Research", "Data Analysis"],
    adjacentSkills: ["Communication", "Business Development", "Product Management"],
    education: "design",
    industries: ["Marketing", "E-commerce", "Media", "SaaS", "Startups"],
    description: "Create demand, content and brand experiences across digital channels.",
  },
  {
    key: "graduate_trainee",
    label: "Graduate Trainee & Apprenticeship Programs",
    titles: [/graduate engineer trainee/i, /\bget\b/i, /management trainee/i, /trainee/i, /apprentice/i, /intern(ship)?\b/i, /fresher/i, /graduate program/i, /campus/i],
    coreSkills: ["Communication", "Problem Solving", "Teamwork", "Excel", "Project Management"],
    adjacentSkills: ["Automotive Engineering", "Manufacturing", "Data Analysis", "Operations", "Software"],
    education: "any",
    industries: ["Automotive", "Manufacturing", "IT", "Consulting", "FMCG"],
    description: "Structured entry-level programs that rotate across functions and build broad capability.",
  },
];

export function classifyRole(title: string, description = ""): RoleFamily {
  const haystack = `${title} ${title} ${description.slice(0, 1200)}`;
  let best = ROLE_FAMILIES.find((r) => r.key === "graduate_trainee")!;
  let bestScore = 0;
  for (const family of ROLE_FAMILIES) {
    let score = 0;
    for (const re of family.titles) {
      const matches = haystack.match(new RegExp(re.source, "gi"));
      if (matches) score += matches.length * (title.match(re) ? 5 : 1);
    }
    if (score > bestScore) {
      best = family;
      bestScore = score;
    }
  }
  if (bestScore === 0) {
    // Fall back to a broad family based on seniority language.
    if (/senior|staff|principal|lead/i.test(title)) {
      return ROLE_FAMILIES.find((r) => r.key === "business_operations")!;
    }
    return ROLE_FAMILIES.find((r) => r.key === "graduate_trainee")!;
  }
  return best;
}

/** Adjacent skill bridge used to give partial credit for transferable skills. */
export const TRANSFERABLE: Record<string, string[]> = {
  "Automotive Engineering": ["Mechanical Design & CAE", "Manufacturing, Quality & Operations Engineering", "Field Service & Technical Support"],
  "Vehicle Dynamics": ["Mechanical Design & CAE"],
  "Powertrain": ["Mechanical Design & CAE", "Manufacturing, Quality & Operations Engineering"],
  "IC Engines": ["Mechanical Design & CAE", "Field Service & Technical Support"],
  "EV Technology": ["Mechanical Design & CAE", "Field Service & Technical Support"],
  CAD: ["Mechanical Design & CAE", "Automotive & EV Engineering"],
  SolidWorks: ["Mechanical Design & CAE"],
  CATIA: ["Mechanical Design & CAE", "Automotive & EV Engineering"],
  MATLAB: ["Data & Business Analysis", "Mechanical Design & CAE"],
  Manufacturing: ["Manufacturing, Quality & Operations Engineering", "Business, Sales & Operations"],
  "Quality Control": ["Manufacturing, Quality & Operations Engineering"],
  "Six Sigma": ["Manufacturing, Quality & Operations Engineering", "Business, Sales & Operations"],
  "Lean Manufacturing": ["Manufacturing, Quality & Operations Engineering"],
  "Project Management": ["Business, Sales & Operations", "Manufacturing, Quality & Operations Engineering", "Data & Business Analysis"],
  Operations: ["Business, Sales & Operations", "Customer & Technical Support"],
  "Supply Chain": ["Business, Sales & Operations"],
  Procurement: ["Business, Sales & Operations"],
  Logistics: ["Business, Sales & Operations"],
  "Problem Solving": ["Data & Business Analysis", "Software Engineering & QA", "Field Service & Technical Support"],
  Communication: ["Business, Sales & Operations", "Customer & Technical Support", "Marketing & Creative"],
  Excel: ["Data & Business Analysis", "Finance, HR & Administration", "Business, Sales & Operations"],
  SQL: ["Data & Business Analysis"],
  Python: ["Data & Business Analysis", "Software Engineering & QA"],
  "Data Analysis": ["Data & Business Analysis", "Business, Sales & Operations", "Marketing & Creative"],
  "Business Analysis": ["Data & Business Analysis", "Business, Sales & Operations"],
  "Customer Support": ["Customer & Technical Support", "Business, Sales & Operations"],
  "Customer Success": ["Business, Sales & Operations", "Customer & Technical Support"],
  Sales: ["Business, Sales & Operations"],
  "Business Development": ["Business, Sales & Operations"],
  "Digital Marketing": ["Marketing & Creative", "Business, Sales & Operations"],
  SEO: ["Marketing & Creative"],
  "Content Writing": ["Marketing & Creative"],
  Accounting: ["Finance, HR & Administration"],
  Tally: ["Finance, HR & Administration"],
  Recruitment: ["Finance, HR & Administration"],
  Payroll: ["Finance, HR & Administration"],
  "Technical Support": ["Field Service & Technical Support", "Customer & Technical Support", "Software Engineering & QA"],
  "Manual Testing": ["Software Engineering & QA"],
  "Automation Testing": ["Software Engineering & QA"],
  "REST APIs": ["Software Engineering & QA"],
  JavaScript: ["Software Engineering & QA"],
  React: ["Software Engineering & QA"],
  "Node.js": ["Software Engineering & QA"],
};

/** Preferred-role keyword map used by career discovery. */
export const CAREER_PATH_KEYWORDS: Record<string, string[]> = {
  "Automotive & EV Engineering": ["automobile", "automotive", "ev", "vehicle", "powertrain", "battery", "engine", "homologation"],
  "Mechanical Design & CAE": ["mechanical", "design", "cad", "cae", "simulation", "thermal", "r&d"],
  "Manufacturing, Quality & Operations Engineering": ["manufacturing", "production", "quality", "maintenance", "plant", "process", "industrial", "lean", "six sigma"],
  "Field Service & Technical Support": ["service engineer", "field engineer", "technical support", "installation", "commissioning", "application engineer"],
  "Software Engineering & QA": ["software", "developer", "frontend", "backend", "full stack", "qa", "tester", "data engineer", "devops"],
  "Data & Business Analysis": ["data analyst", "business analyst", "bi", "analytics", "mis", "reporting", "insights"],
  "Business, Sales & Operations": ["business development", "sales", "operations", "management trainee", "customer success", "supply chain", "logistics", "procurement", "generalist", "founder's office"],
  "Customer & Technical Support": ["customer support", "customer service", "voice process", "chat support", "service desk", "support executive"],
  "Finance, HR & Administration": ["finance", "accounts", "banking operations", "payroll", "recruitment", "hr", "back office", "data entry", "audit"],
  "Marketing & Creative": ["marketing", "seo", "social media", "content", "graphic design", "video editor", "brand", "growth"],
  "Graduate Trainee & Apprenticeship Programs": ["graduate engineer trainee", "get", "trainee", "apprentice", "intern", "fresher", "graduate program"],
};

export function skillsForProfile(profile: Pick<CandidateProfile, "skills">): Set<string> {
  return new Set(profile.skills.map((s) => canonicalSkill(s.name)));
}

export function candidateRoleFamilies(profile: CandidateProfile, prefs?: CandidatePreferences): Set<string> {
  const families = new Set<string>();
  const hay = [
    ...profile.skills.map((s) => s.name),
    profile.degree,
    profile.headline,
    ...(prefs?.targetRoles ?? []),
    ...(prefs?.industries ?? []),
  ].join(" ");
  for (const family of ROLE_FAMILIES) {
    const keywords = CAREER_PATH_KEYWORDS[family.label] ?? [];
    if (keywords.some((k) => hay.toLowerCase().includes(k))) families.add(family.label);
  }
  if (families.size === 0) {
    families.add("Graduate Trainee & Apprenticeship Programs");
    families.add("Business, Sales & Operations");
  }
  return families;
}

/** Used only by the UI for empty-state hints, not by the scoring engine. */
export const BROAD_JOB_CATEGORIES: { label: string; roles: string[] }[] = [
  { label: "Engineering & technical", roles: ["Automobile Engineer", "Mechanical Engineer", "Graduate Engineer Trainee", "Production Engineer", "Quality Engineer", "Maintenance Engineer", "Design / CAD Engineer", "Manufacturing Engineer", "Service Engineer", "Technical Support Engineer", "Field Engineer", "Robotics", "Industrial Engineering"] },
  { label: "IT & software", roles: ["Software Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "QA Engineer", "Software Tester", "IT Support", "System Administrator", "Data Analyst", "BI Analyst", "Junior Data Engineer", "AI/ML Intern", "Product Support"] },
  { label: "Business & corporate", roles: ["Business Analyst", "Operations Executive", "Business Development Executive", "Sales Executive", "Customer Success Associate", "Account Executive", "Process Associate", "Management Trainee", "Project Coordinator", "Procurement Executive", "Supply Chain Associate", "Logistics Executive"] },
  { label: "Customer support", roles: ["Customer Support Executive", "Technical Support Associate", "Customer Success Associate", "Chat Support", "Email Support", "International Voice Process", "Service Desk Analyst"] },
  { label: "Finance & administration", roles: ["Finance Associate", "Banking Operations", "Accounts Assistant", "MIS Executive", "Back Office Executive", "HR Assistant", "Recruitment Coordinator", "Payroll Assistant"] },
  { label: "Marketing & creative", roles: ["Digital Marketing Executive", "SEO Executive", "Social Media Executive", "Content Writer", "Marketing Associate", "Graphic Design Assistant", "Video Editor"] },
  { label: "Other sectors", roles: ["E-commerce", "Retail", "Hospitality", "Healthcare administration", "Education", "EdTech", "FinTech", "Logistics", "Renewable energy", "Insurance", "Telecom", "Government opportunities", "Apprenticeships", "Graduate programs", "Startup generalist"] },
];

/** Adjacent skills that earn partial credit (35%) in the deterministic matcher. */
export const SKILL_BRIDGES: Record<string, string[]> = {
  CAD: ["SolidWorks", "CATIA", "AutoCAD", "Creo", "NX", "GD&T", "FEA", "CFD"],
  SolidWorks: ["CAD", "CATIA", "Creo", "NX", "GD&T"],
  CATIA: ["CAD", "SolidWorks", "Creo", "NX", "GD&T"],
  AutoCAD: ["CAD", "SolidWorks", "CATIA"],
  FEA: ["ANSYS", "Abaqus", "CAD", "CFD"],
  CFD: ["FEA", "ANSYS", "CAD"],
  Manufacturing: ["Production Planning", "Lean Manufacturing", "Six Sigma", "Quality Control", "Maintenance"],
  "Production Planning": ["Manufacturing", "Lean Manufacturing", "Supply Chain"],
  "Quality Control": ["ISO Standards", "Six Sigma", "GD&T", "Manufacturing"],
  "Six Sigma": ["Quality Control", "Lean Manufacturing", "Manufacturing"],
  "Lean Manufacturing": ["Six Sigma", "Quality Control", "Production Planning"],
  Maintenance: ["Manufacturing", "PLC", "Robotics"],
  "Supply Chain": ["Logistics", "Procurement", "Operations", "Production Planning"],
  Procurement: ["Supply Chain", "Logistics", "Negotiation"],
  Logistics: ["Supply Chain", "Operations", "Procurement"],
  "Project Management": ["Operations", "Supply Chain", "Business Analysis"],
  Operations: ["Supply Chain", "Logistics", "Project Management", "Customer Support"],
  PLC: ["SCADA", "Robotics", "Maintenance", "Embedded Systems"],
  SCADA: ["PLC", "Robotics", "IoT"],
  Robotics: ["PLC", "SCADA", "Mechatronics", "Embedded Systems"],
  "Embedded Systems": ["IoT", "PLC", "Robotics"],
  "Automotive Engineering": ["Vehicle Dynamics", "Powertrain", "IC Engines", "EV Technology", "CAD"],
  "EV Technology": ["Battery Systems", "Automotive Engineering", "Powertrain"],
  Powertrain: ["Automotive Engineering", "IC Engines", "EV Technology", "Vehicle Dynamics"],
  "Vehicle Dynamics": ["Automotive Engineering", "Powertrain", "CAD"],
  Excel: ["Data Analysis", "Power BI", "Tableau", "MIS Reporting", "Accounting"],
  "Data Analysis": ["Power BI", "Tableau", "Statistics", "SQL", "Excel", "Data Visualization"],
  SQL: ["Data Analysis", "Data Visualization", "NoSQL"],
  Python: ["Data Analysis", "Machine Learning", "Automation Testing", "Statistics"],
  "Power BI": ["Tableau", "Data Visualization", "Excel", "Data Analysis"],
  Tableau: ["Power BI", "Data Visualization", "Excel", "Data Analysis"],
  "Data Visualization": ["Power BI", "Tableau", "Data Analysis"],
  "Machine Learning": ["Python", "Statistics", "Data Analysis"],
  "Business Analysis": ["Data Analysis", "Project Management", "Operations", "MIS Reporting"],
  "Technical Support": ["Customer Support", "Networking", "System Administration", "Problem Solving"],
  "Customer Support": ["Customer Success", "Communication", "CRM"],
  "Customer Success": ["Customer Support", "CRM", "Business Development"],
  Sales: ["Business Development", "CRM", "Negotiation", "Communication"],
  "Business Development": ["Sales", "CRM", "Market Research", "Negotiation"],
  CRM: ["Sales", "Customer Success", "Business Development"],
  "Digital Marketing": ["SEO", "Social Media Marketing", "Content Writing", "Market Research"],
  SEO: ["Digital Marketing", "Content Writing", "Market Research"],
  "Social Media Marketing": ["Digital Marketing", "Content Writing", "Graphic Design"],
  "Content Writing": ["SEO", "Digital Marketing", "Communication"],
  Accounting: ["Tally", "Financial Analysis", "Excel", "MIS Reporting"],
  Tally: ["Accounting", "Financial Analysis"],
  "Financial Analysis": ["Accounting", "Excel", "Data Analysis"],
  "Banking Operations": ["Financial Analysis", "Accounting", "Attention to Detail"],
  "MIS Reporting": ["Excel", "Data Analysis", "Power BI"],
  Payroll: ["Accounting", "Excel", "Attention to Detail"],
  Recruitment: ["Communication", "Payroll", "CRM"],
  "Manual Testing": ["Automation Testing", "QA Engineering", "Attention to Detail"],
  "Automation Testing": ["Manual Testing", "QA Engineering", "Python", "JavaScript"],
  "QA Engineering": ["Manual Testing", "Automation Testing", "Problem Solving"],
  React: ["JavaScript", "TypeScript", "HTML", "CSS", "Next.js"],
  "Node.js": ["JavaScript", "TypeScript", "REST APIs", "SQL"],
  JavaScript: ["TypeScript", "React", "Node.js", "HTML", "CSS"],
  TypeScript: ["JavaScript", "React", "Node.js"],
  "REST APIs": ["Node.js", "SQL", "Technical Support"],
  Docker: ["Linux", "AWS", "Azure", "GCP"],
  AWS: ["Azure", "GCP", "Docker", "Linux"],
  Linux: ["Docker", "Networking", "System Administration"],
  Networking: ["System Administration", "Technical Support", "Cybersecurity"],
  Communication: ["Customer Support", "Sales", "Negotiation", "Content Writing"],
  "Problem Solving": ["Data Analysis", "Technical Support", "Quality Control"],
};

export type { JobMatchResult, NormalizedJob };







