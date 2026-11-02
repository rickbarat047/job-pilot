import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getCompanyContacts } from "@/lib/companies/contacts";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const contacts = await getCompanyContacts(id);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load contacts." }, { status: 400 });
  }
}
