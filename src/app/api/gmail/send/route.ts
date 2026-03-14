import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/gmail";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { to, subject, body, applicationId } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  try {
    const result = await sendEmail(session.user.id, to, subject, body);

    // Update application status if linked
    if (applicationId) {
      await db.application.update({
        where: { id: applicationId, userId: session.user.id },
        data: { status: "applied", notes: `Email sent to ${to} on ${new Date().toLocaleDateString()}` },
      });
    }

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
