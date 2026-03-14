import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchRecentEmails } from "@/lib/gmail";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check if Gmail is connected
  const token = await db.gmailToken.findUnique({ where: { userId } });
  if (!token) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
  }

  try {
    const emails = await fetchRecentEmails(userId);

    if (emails.length === 0) {
      return NextResponse.json({ scanned: 0, newEmails: [] });
    }

    // Get existing tracked email IDs to avoid duplicates
    const existingIds = new Set(
      (await db.emailTracking.findMany({
        where: { userId },
        select: { gmailMsgId: true },
      })).map((e) => e.gmailMsgId)
    );

    const newEmails = emails.filter((e) => e.id && !existingIds.has(e.id));

    if (newEmails.length === 0) {
      return NextResponse.json({ scanned: emails.length, newEmails: [] });
    }

    // Get user's applications for matching
    const applications = await db.application.findMany({
      where: { userId },
      select: { id: true, company: true, jobTitle: true },
    });

    // Use AI to classify emails
    const openai = getOpenAI();
    const classificationPrompt = `Classify these job-related emails. For each email, determine:
1. category: "interview_invite", "rejection", "offer", "follow_up", "application_received", "other"
2. company: the company name if detectable
3. sentiment: "positive", "negative", "neutral"
4. action_needed: brief description of what the user should do, or null

Known applications: ${applications.map((a) => `${a.jobTitle} at ${a.company}`).join(", ")}

Emails:
${newEmails.map((e, i) => `[${i}] From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet}`).join("\n")}

Return a JSON array with one object per email:
[{"index": 0, "category": "string", "company": "string", "sentiment": "string", "action_needed": "string or null", "matched_application": "company name if matches a known application"}]
Only return valid JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You classify job application emails. Return only valid JSON." },
        { role: "user", content: classificationPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content!);
    const classifications = Array.isArray(parsed) ? parsed : parsed.classifications || parsed.emails || [];

    // Save classified emails
    const savedEmails = [];
    for (let i = 0; i < newEmails.length; i++) {
      const email = newEmails[i];
      const classification = classifications[i] || { category: "other", sentiment: "neutral" };

      // Try to match with an existing application
      let matchedAppId: string | null = null;
      if (classification.matched_application) {
        const match = applications.find(
          (a) => a.company.toLowerCase().includes(classification.matched_application.toLowerCase())
        );
        if (match) {
          matchedAppId = match.id;

          // Auto-update application status based on email category
          const statusMap: Record<string, string> = {
            interview_invite: "interview",
            rejection: "rejected",
            offer: "offered",
            application_received: "in_review",
          };
          if (statusMap[classification.category]) {
            await db.application.update({
              where: { id: match.id },
              data: { status: statusMap[classification.category] },
            });
          }
        }
      }

      const tracked = await db.emailTracking.create({
        data: {
          userId,
          applicationId: matchedAppId,
          gmailMsgId: email.id,
          subject: email.subject,
          fromEmail: email.from,
          snippet: email.snippet,
          category: classification.category || "other",
          parsedData: JSON.stringify(classification),
          receivedAt: email.date ? new Date(email.date) : new Date(),
        },
      });

      savedEmails.push({ ...tracked, classification });
    }

    return NextResponse.json({
      scanned: emails.length,
      newEmails: savedEmails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Retrieve tracked emails
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = await db.emailTracking.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(emails);
}
