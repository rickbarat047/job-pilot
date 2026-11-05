import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getApplications } from "@/lib/repositories";

export const runtime = "nodejs";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const applications = await getApplications(user.id, {
      state: url.searchParams.get("state") ?? undefined,
      query: url.searchParams.get("query") ?? undefined,
      limit: 1000,
    });

    const header = ["ID", "State", "Job Title", "Company", "Location", "Match Score", "Application Method", "Salary", "Remote", "Applied At", "Created At", "Application URL", "Notes"].join(",");
    const rows = applications.map((a) => [
      a.id, a.state, a.jobTitle, a.company, a.location, a.matchScore ?? "", a.applicationMethod,
      a.salaryText ?? "", a.remoteStatus, a.appliedAt ?? "", a.createdAt, a.applicationUrl, a.notes ?? "",
    ].map(csvEscape).join(","));
    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="jobpilot-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}