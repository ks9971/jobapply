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

  const { success } = rateLimit(`ai-ats-score:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { jobDescription, resumeContent: providedResume, jobTitle } = await req.json();

  if (!jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required" },
      { status: 400 }
    );
  }

  // Auto-fetch resume from user's profile if not provided
  let resumeContent = providedResume;
  if (!resumeContent?.trim()) {
    // Try to get latest CV document
    const latestCV = await db.cVDocument.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (latestCV?.fileContent) {
      resumeContent = latestCV.fileContent;
    } else {
      // Build resume from profile data
      const profile = await db.profile.findUnique({
        where: { userId: session.user.id },
        include: { education: true, experience: true, skills: true },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "No resume or profile found. Please upload a CV first." },
          { status: 400 }
        );
      }

      resumeContent = [
        profile.headline || "",
        profile.summary || "",
        profile.experience.map((e) => `${e.title} at ${e.company}: ${e.description || ""}`).join("\n"),
        profile.education.map((e) => `${e.degree} ${e.field || ""} from ${e.institution}`).join("\n"),
        profile.skills.map((s) => s.name).join(", "),
      ].filter(Boolean).join("\n\n");
    }
  }

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an ATS (Applicant Tracking System) expert. Analyze a resume against a job description and provide a detailed ATS compatibility score.

Indian ATS systems (used by Naukri, Freshteam, Zoho Recruit, Darwinbox) typically check for:
1. Keyword match between JD and resume
2. Proper section headings (Experience, Education, Skills, Summary)
3. Quantified achievements with metrics
4. Consistent date formatting
5. No graphics, tables, or complex formatting
6. Contact information completeness
7. Relevant skills and certifications
8. Experience level match
9. Location/willingness to relocate

Return your analysis as valid JSON with this exact structure:
{
  "score": <number 0-100>,
  "summary": "<1-2 sentence overall assessment>",
  "keywords_found": ["keyword1", "keyword2"],
  "keywords_missing": ["keyword1", "keyword2"],
  "section_scores": {
    "keyword_match": <0-100>,
    "formatting": <0-100>,
    "experience_relevance": <0-100>,
    "skills_match": <0-100>,
    "achievements": <0-100>
  },
  "suggestions": [
    {"priority": "high", "text": "suggestion text"},
    {"priority": "medium", "text": "suggestion text"},
    {"priority": "low", "text": "suggestion text"}
  ],
  "formatting_issues": ["issue1", "issue2"]
}

Be honest and specific. Don't inflate scores. Indian recruiters search for exact keyword matches.`,
      },
      {
        role: "user",
        content: `## Job Description:\n${jobDescription}\n\n## Resume:\n${resumeContent}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const analysisText = response.choices[0].message.content!;
  let analysis;
  try {
    analysis = JSON.parse(analysisText);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse ATS analysis" },
      { status: 500 }
    );
  }

  // Save to database
  const saved = await db.aTSAnalysis.create({
    data: {
      userId: session.user.id,
      jobTitle: jobTitle || null,
      jobDescription,
      resumeContent,
      score: analysis.score,
      analysis: analysisText,
    },
  });

  return NextResponse.json({ id: saved.id, score: analysis.score, ...analysis });
}

// Get ATS analysis history
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analyses = await db.aTSAnalysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      jobTitle: true,
      score: true,
      createdAt: true,
    },
  });

  return NextResponse.json(analyses);
}
