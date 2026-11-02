import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { trackCompany } from "@/lib/repositories";
import { z } from "zod";

const schema = z.object({ status: z.string().default("watching") });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { status } = schema.parse(body);
    await trackCompany(user.id, id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to track company." }, { status: 400 });
  }
}
