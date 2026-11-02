import { getDb } from "./db";
import { createUser } from "./auth";
import { saveProfile, savePreferences, savePermissions } from "./repositories";
import { runDiscovery } from "./discovery";
import { DEFAULT_PERMISSIONS } from "./permissions";

export async function seedDemo(): Promise<{ userId: string; discovery?: unknown; message: string }> {
  getDb();
  const email = "demo@jobpilot.ai";
  const password = "Demo@12345";
  let userId = "";
  try {
    const user = await createUser({ email, password, name: "Aarav Sharma" });
    userId = user.id;
  } catch {
    const existing = await (await import("./db")).get<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
    if (!existing) throw new Error("Unable to create or find demo user.");
    userId = existing.id;
  }

  const demoProfile = {
    fullName: "Aarav Sharma",
    email,
    phone: "+919876543210",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    headline: "B.Tech Automobile Engineering graduate open to engineering, operations and technology roles",
    summary: "B.Tech Automobile Engineering graduate with hands-on project experience in vehicle systems, CAD, quality checks and data analysis. Comfortable learning new tools and working across engineering, operations, customer success and technology roles.",
    degree: "B.Tech Automobile Engineering",
    university: "Visvesvaraya Technological University",
    graduationYear: "2025",
    cgpa: "7.8 CGPA",
    experienceYears: 0.5,
    currentStatus: "Fresher",
    noticePeriod: "Immediate",
    languages: ["English", "Hindi", "Kannada"],
    skills: [
      { name: "Automotive Engineering" }, { name: "CAD" }, { name: "SolidWorks" }, { name: "Quality Control" },
      { name: "Manufacturing" }, { name: "Excel" }, { name: "Data Analysis" }, { name: "Python" },
      { name: "Communication" }, { name: "Problem Solving" }, { name: "Project Management" },
    ],
    projects: [
      { name: "Hybrid Go-Kart Powertrain", description: "Designed and fabricated a hybrid go-kart powertrain, performed load calculations and basic FEA.", technologies: ["CAD", "SolidWorks", "Automotive Engineering"] },
      { name: "EV Battery Pack Thermal Study", description: "Studied thermal behaviour of a small EV battery pack and proposed cooling improvements.", technologies: ["EV Technology", "Battery Systems", "Data Analysis"] },
    ],
    internships: [
      { role: "Engineering Intern", company: "ABC Auto Components", startDate: "May 2024", endDate: "Jul 2024", location: "Bengaluru", description: "Supported production line quality checks, maintained inspection records and assisted with CAD drawings.", highlights: ["Quality Control", "Manufacturing", "CAD"] },
    ],
    experience: [],
    certifications: ["NPTEL Introduction to Automotive Engineering"],
    education: [{ degree: "B.Tech Automobile Engineering", field: "Automobile Engineering", university: "Visvesvaraya Technological University", graduationYear: "2025", score: "7.8 CGPA" }],
    rawCvText: "Demo CV for JobPilot AI.",
  };
  await saveProfile(userId, demoProfile as any);
  await savePreferences(userId, {
    targetRoles: ["Graduate Engineer Trainee", "Quality Engineer", "Production Engineer", "Data Analyst", "Business Analyst", "Customer Success Associate"],
    experienceLevels: ["Fresher", "Entry-level"],
    employmentTypes: ["Full-time", "Internship", "Graduate trainee", "Contract"],
    workModes: ["On-site", "Hybrid", "Remote"],
    preferredLocations: ["Bengaluru", "Pune", "Hyderabad", "Chennai", "Mumbai"],
    allIndia: true,
    remoteIndia: true,
    internationalRemote: false,
    minSalaryLpa: 4,
    salaryFlexible: true,
    unpaidInternship: false,
    paidInternship: true,
    industries: ["Automotive", "Manufacturing", "IT", "FinTech", "E-commerce"],
    flexibility: { anyIndustry: true, anyRole: true, willingToLearn: true, willingToRelocate: true, willingToRemote: true, entryLevel: true, startups: true, nonCore: true },
    matchWeights: { skills: 30, education: 15, experience: 15, career: 15, location: 10, salary: 5, flexibility: 5, freshness: 5 },
  } as any);
  await savePermissions(userId, { ...DEFAULT_PERMISSIONS, demoMode: true });

  let discovery;
  try {
    discovery = await runDiscovery(userId, { match: true });
  } catch (error) {
    discovery = { error: error instanceof Error ? error.message : String(error) };
  }

  return { userId, discovery, message: "Demo account ready. Email: demo@jobpilot.ai, Password: Demo@12345" };
}


