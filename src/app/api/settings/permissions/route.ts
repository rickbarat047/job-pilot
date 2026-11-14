import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireApiUser } from "@/lib/auth";
import { getPermissionsForUser, savePermissions } from "@/lib/repositories";
import { AUTO_APPLY_CATEGORIES } from "@/lib/permissions";

const permissionMode = z.enum(["automatic", "approval", "never"]);
const permissionsSchema = z.object({
  autonomyLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  searchJobs: permissionMode,
  analyzeJobs: permissionMode,
  matchJobs: permissionMode,
  generateResumes: permissionMode,
  generateCoverLetters: permissionMode,
  saveDrafts: permissionMode,
  submitApplications: permissionMode,
  sendRecruiterEmails: permissionMode,
  answerSensitiveQuestions: permissionMode,
  acceptOffers: z.literal("never"),
  sharePersonalInfo: permissionMode,
  autoApplyCategories: z.array(z.enum(AUTO_APPLY_CATEGORIES)).max(AUTO_APPLY_CATEGORIES.length),
  autoApplyMinScore: z.number().min(70).max(100),
  allowDuplicateApplications: z.boolean(),
  demoMode: z.boolean(),
}).strict();

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ permissions: await getPermissionsForUser(user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = permissionsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid automation permissions. Check the selected options and score range." }, { status: 400 });
    await savePermissions(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as Error & { status: number }).status) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save permissions." }, { status });
  }
}
