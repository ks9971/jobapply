import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAuthUrl } from "@/lib/gmail";

// GET: Check Gmail connection status + get auth URL
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await db.gmailToken.findUnique({
    where: { userId: session.user.id },
  });

  if (token) {
    return NextResponse.json({
      connected: true,
      email: token.email,
      expiresAt: token.expiresAt,
    });
  }

  const authUrl = getAuthUrl();
  return NextResponse.json({ connected: false, authUrl });
}

// DELETE: Disconnect Gmail
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.gmailToken.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ message: "Gmail disconnected" });
}
