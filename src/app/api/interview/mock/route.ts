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

  const { success } = rateLimit(`interview-mock:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { jobTitle, company, questionCount = 5 } = body;

  if (!jobTitle?.trim()) {
    return NextResponse.json(
      { error: "Job title is required" },
      { status: 400 }
    );
  }

  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 15);

  // Fetch user profile for context
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: { skills: true, experience: true },
  });

  const profileContext = profile
    ? [
        profile.headline ? `Role: ${profile.headline}` : "",
        profile.experience.length > 0
          ? `Experience: ${profile.experience.map((e) => `${e.title} at ${e.company}`).join(", ")}`
          : "",
        profile.skills.length > 0
          ? `Skills: ${profile.skills.map((s) => s.name).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const systemPrompt = `You are an experienced interviewer conducting a mock interview for the Indian job market. Generate exactly ${count} interview questions for the given role.

Mix of question types:
- 40% Technical questions relevant to the role
- 30% Behavioral/situational questions
- 30% HR questions (India-specific: CTC expectations, notice period, career goals)

Questions should progressively increase in difficulty. Make them realistic — the kind actually asked in Indian tech interviews at companies like TCS, Infosys, Flipkart, Razorpay, Google India, etc.

${profileContext ? `\nCandidate background:\n${profileContext}\nTailor question difficulty to their experience level.` : ""}

Return valid JSON:
{
  "questions": ["question 1", "question 2", ...]
}`;

  const userMessage = [
    `Role: ${jobTitle}`,
    company ? `Company: ${company}` : "",
    `Number of questions: ${count}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const questions: string[] = parsed.questions || [];
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions generated" },
        { status: 500 }
      );
    }

    const mockSession = await db.mockSession.create({
      data: {
        userId: session.user.id,
        jobTitle: jobTitle.trim(),
        company: company?.trim() || null,
        questions: JSON.stringify(questions),
        userAnswers: "[]",
        status: "in_progress",
      },
    });

    return NextResponse.json({
      sessionId: mockSession.id,
      jobTitle: mockSession.jobTitle,
      company: mockSession.company,
      totalQuestions: questions.length,
      currentQuestion: {
        index: 0,
        question: questions[0],
      },
    });
  } catch (error) {
    console.error("Mock interview start error:", error);
    return NextResponse.json(
      { error: "Failed to start mock interview" },
      { status: 500 }
    );
  }
}

// Get user's mock sessions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db.mockSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      jobTitle: true,
      company: true,
      totalScore: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json(sessions);
}
