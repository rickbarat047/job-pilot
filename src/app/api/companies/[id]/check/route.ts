import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { checkCompanyCareerPage } from "@/lib/companies/check";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const result = await checkCompanyCareerPage(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check career page." }, { status: 400 });
  }
}
