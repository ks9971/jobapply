import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOAuth2Client } from "@/lib/gmail";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", req.url));
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's Gmail address
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress || "";

    // Store tokens
    await db.gmailToken.upsert({
      where: { userId: session.user.id },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || "",
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
      create: {
        userId: session.user.id,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
    });

    return NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=gmail_auth_failed", req.url));
  }
}
