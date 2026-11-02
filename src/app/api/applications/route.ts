import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplications } from "@/lib/repositories";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const applications = await getApplications(user.id, {
      state: url.searchParams.get("state") ?? undefined,
      query: url.searchParams.get("query") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 200,
    });
    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

