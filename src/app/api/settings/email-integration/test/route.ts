import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getProfile, getPermissionsForUser } from "@/lib/repositories";
import { sendApplicationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const permissions = await getPermissionsForUser(user.id);
    const profile = await getProfile(user.id);
    const body = await request.json().catch(() => ({}));
    const to = String(body.to || profile.email || "").trim();
    if (!to) return NextResponse.json({ error: "No recipient email available." }, { status: 400 });

    const result = await sendApplicationEmail({
      userId: user.id,
      to,
      subject: "JobPilot AI test email",
      body: "This is a test email from JobPilot AI. If you received it, your email integration is working.",
      demoMode: permissions.demoMode,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send test email." }, { status: 400 });
  }
}
