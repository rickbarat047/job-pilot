import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { discoverCompanyContacts } from "@/lib/companies/contacts";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const contacts = await discoverCompanyContacts(id);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to discover contacts." }, { status: 400 });
  }
}
