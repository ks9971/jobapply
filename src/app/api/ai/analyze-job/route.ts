import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`ai-analyze-job:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { jobDescription, jobTitle, company } = await req.json();
  if (!jobDescription) {
    return NextResponse.json({ error: "Job description is required" }, { status: 400 });
  }

  // Get user profile
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      education: true,
      experience: { orderBy: { startDate: "desc" } },
      skills: true,
    },
  });

  const user = await db.user.findUnique({ where: { id: session.user.id } });

  if (!profile) {
    return NextResponse.json({ error: "Please set up your profile first" }, { status: 400 });
  }

  const profileSummary = `
Name: ${user?.name || "N/A"}
Headline: ${profile.headline || "N/A"}
Summary: ${profile.summary || "N/A"}
Skills: ${profile.skills.map((s) => `${s.name} (${s.level})`).join(", ") || "None"}
Experience: ${profile.experience.map((e) => `${e.title} at ${e.company}`).join("; ") || "None"}
Education: ${profile.education.map((e) => `${e.degree} in ${e.field || "N/A"} from ${e.institution}`).join("; ") || "None"}
`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a job matching AI. Analyze how well the candidate matches a job description.
Return a JSON object:
{
  "matchScore": number (0-100),
  "strengths": ["string array of matching qualifications"],
  "gaps": ["string array of missing/weak areas"],
  "suggestions": ["string array of how to strengthen application"],
  "tailoredSummary": "string - a rewritten professional summary tailored for this job",
  "interviewQuestions": ["5 likely interview questions for this role"],
  "salaryRange": "estimated salary range for this role in India (INR)"
}
Be honest and specific. Don't inflate the match score.
Only return valid JSON.`,
      },
      {
        role: "user",
        content: `Candidate Profile:\n${profileSummary}\n\nJob Description:\n${jobDescription}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const analysis = JSON.parse(response.choices[0].message.content!);

  // Save as a saved job if title/company provided
  if (jobTitle || company) {
    await db.savedJob.create({
      data: {
        userId: session.user.id,
        title: jobTitle || "Unknown Role",
        company: company || "Unknown Company",
        description: jobDescription.substring(0, 5000),
        matchScore: analysis.matchScore,
        matchReason: analysis.strengths.join("; "),
        source: "manual",
      },
    });
  }

  return NextResponse.json(analysis);
}
