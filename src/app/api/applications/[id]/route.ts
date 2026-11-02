import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplicationDetail } from "@/lib/repositories";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const detail = await getApplicationDetail(user.id, id);
    if (!detail) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json({ application: detail });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
