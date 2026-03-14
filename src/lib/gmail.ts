import { google } from "googleapis";
import { db } from "@/lib/db";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/gmail/callback`
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function getGmailClient(userId: string) {
  const token = await db.gmailToken.findUnique({ where: { userId } });
  if (!token) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (token.expiresAt < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await db.gmailToken.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date!),
      },
    });
    oauth2Client.setCredentials(credentials);
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
  attachmentName?: string,
  attachmentContent?: string
) {
  const gmail = await getGmailClient(userId);
  if (!gmail) throw new Error("Gmail not connected");

  let emailContent: string;

  if (attachmentContent && attachmentName) {
    const boundary = "boundary_" + Date.now();
    emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${attachmentName}"`,
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      `Content-Transfer-Encoding: base64`,
      "",
      attachmentContent,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\r\n");
  }

  const encodedMessage = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return res.data;
}

export async function fetchRecentEmails(userId: string, query?: string) {
  const gmail = await getGmailClient(userId);
  if (!gmail) throw new Error("Gmail not connected");

  const searchQuery = query || "subject:(application OR interview OR offer OR position OR role OR job OR hiring) newer_than:7d";

  const res = await gmail.users.messages.list({
    userId: "me",
    q: searchQuery,
    maxResults: 20,
  });

  if (!res.data.messages) return [];

  const emails = [];
  for (const msg of res.data.messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const headers = detail.data.payload?.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    emails.push({
      id: msg.id,
      threadId: msg.threadId,
      subject,
      from,
      date,
      snippet: detail.data.snippet || "",
    });
  }

  return emails;
}
