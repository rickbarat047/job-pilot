import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getJobDetailForUser } from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (ids.length < 2) {
      return NextResponse.json({ error: "Provide at least 2 job ids (comma-separated, max 3)." }, { status: 400 });
    }

    const details = await Promise.all(ids.map((id) => getJobDetailForUser(user.id, id)));
    const items = details.filter(Boolean);
    if (items.length < 2) {
      return NextResponse.json({ error: "Could not load enough job details." }, { status: 404 });
    }
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}