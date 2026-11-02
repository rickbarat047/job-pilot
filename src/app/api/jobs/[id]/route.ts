import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getJobDetailForUser } from "@/lib/repositories";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const job = await getJobDetailForUser(user.id, id);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
