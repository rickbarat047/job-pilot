import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getCompanies, trackCompany } from "@/lib/repositories";
import { checkCompanyCareerPage } from "@/lib/companies/check";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const companies = await getCompanies(user.id, {
      query: url.searchParams.get("query") ?? undefined,
      stage: url.searchParams.get("stage") ?? undefined,
      industry: url.searchParams.get("industry") ?? undefined,
      tracked: url.searchParams.get("tracked") === "true",
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100,
    });
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

