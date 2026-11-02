import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { saveJobState } from "@/lib/repositories";
import { z } from "zod";

const schema = z.object({ state: z.enum(["saved", "shortlisted"]).nullable() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { state } = schema.parse(body);
    await saveJobState(user.id, id, state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update saved job." }, { status: 400 });
  }
}
