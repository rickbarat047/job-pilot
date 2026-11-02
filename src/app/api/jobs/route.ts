import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getJobsForUser, getJobDetailForUser, saveJobState } from "@/lib/repositories";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const filters = {
      query: url.searchParams.get("query") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      location: url.searchParams.get("location") ?? undefined,
      remote: url.searchParams.get("remote") ?? undefined,
      employment: url.searchParams.get("employment") ?? undefined,
      minScore: url.searchParams.get("minScore") ? Number(url.searchParams.get("minScore")) : undefined,
      saved: url.searchParams.get("saved") === "true",
      shortlisted: url.searchParams.get("shortlisted") === "true",
      applied: url.searchParams.get("applied") === "true",
      sort: (url.searchParams.get("sort") as "match" | "newest" | "salary") ?? "match",
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 24,
    };
    const result = await getJobsForUser(user.id, filters);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

