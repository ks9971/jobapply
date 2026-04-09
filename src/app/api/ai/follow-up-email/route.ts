import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicationId } = await req.json();

  if (!applicationId) {
    return NextResponse.json(
      { error: "Application ID is required" },
      { status: 400 }
    );
  }

  // Get application details
  const application = await db.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Get user profile for name
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  const daysSinceApplied = Math.floor(
    (Date.now() - new Date(application.appliedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const followUpNumber = application.followUpCount + 1;

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional email writer specializing in job application follow-ups for the Indian job market.

Write a polite, professional follow-up email. Indian HR teams receive many applications, so the email should be:
- Respectful and not pushy
- Brief (under 150 words)
- Reference the specific role and when they applied
- Show continued interest without desperation
- Professional sign-off

This is follow-up #${followUpNumber} sent ${daysSinceApplied} days after the initial application.

${followUpNumber === 1 ? "This is the first follow-up. Be warm and express continued interest." : "This is a subsequent follow-up. Be more concise, mention the previous follow-up, and ask if there's any update."}

Return valid JSON:
{
  "subject": "Follow-up email subject line",
  "body": "The full email body (plain text, use \\n for line breaks)"
}`,
      },
      {
        role: "user",
        content: `Applicant Name: ${user?.name || "Job Applicant"}
Role Applied For: ${application.jobTitle}
Company: ${application.company}
Applied On: ${new Date(application.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
Days Since Applied: ${daysSinceApplied}
Original Cover Letter Summary: ${application.coverLetter ? application.coverLetter.substring(0, 300) : "Not available"}`,
      },
    ],
    temperature: 0.6,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const emailContent = JSON.parse(response.choices[0].message.content!);

  return NextResponse.json({
    subject: emailContent.subject,
    body: emailContent.body,
    applicationId: application.id,
    followUpNumber,
    daysSinceApplied,
  });
}
