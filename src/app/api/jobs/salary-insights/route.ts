import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { all } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const location = url.searchParams.get("location") || "";

    const where: string[] = ["j.status != 'expired'", "j.salary_min IS NOT NULL", "j.salary_max IS NOT NULL"];
    const params: (string | number)[] = [];

    if (query) {
      where.push("(j.title LIKE ? OR j.company_name LIKE ? OR j.description LIKE ?)");
      const q = `%${query}%`;
      params.push(q, q, q);
    }
    if (location) {
      where.push("(j.city LIKE ? OR j.location LIKE ?)");
      const loc = `%${location}%`;
      params.push(loc, loc);
    }

    const rows = await all<{
      min: number | null;
      max: number | null;
      avg: number | null;
      count: number;
      currency: string | null;
    }>(
      `SELECT 
        MIN(j.salary_min) as min,
        MAX(j.salary_max) as max,
        AVG(j.salary_min + j.salary_max) / 2 as avg,
        COUNT(*) as count,
        j.salary_currency as currency
       FROM jobs j
       WHERE ${where.join(" AND ")}
       GROUP BY j.salary_currency
       ORDER BY count DESC
       LIMIT 1`,
      params,
    );

    if (rows.length === 0) {
      return NextResponse.json({
        hasData: false,
        message: "No salary data available for this search.",
      });
    }

    const row = rows[0];
    return NextResponse.json({
      hasData: true,
      min: Number(row.min),
      max: Number(row.max),
      avg: Math.round(Number(row.avg)),
      count: Number(row.count),
      currency: row.currency || "INR",
      query,
      location,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch salary insights." }, { status: 500 });
  }
}