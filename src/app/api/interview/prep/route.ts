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

  const { success } = rateLimit(`interview-prep:${session.user.id}`, 10, 60000);
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

  const { jobTitle, company, prepType = "full", jobDescription } = body;

  if (!jobTitle?.trim()) {
    return NextResponse.json(
      { error: "Job title is required" },
      { status: 400 }
    );
  }

  const validPrepTypes = ["full", "technical", "hr", "behavioral"];
  if (!validPrepTypes.includes(prepType)) {
    return NextResponse.json(
      { error: `Invalid prepType. Must be one of: ${validPrepTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Fetch user profile for context
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: { education: true, experience: true, skills: true },
  });

  const profileContext = profile
    ? [
        profile.headline ? `Current Role: ${profile.headline}` : "",
        profile.experience.length > 0
          ? `Experience: ${profile.experience.map((e) => `${e.title} at ${e.company} (${e.description || ""})`).join("; ")}`
          : "",
        profile.education.length > 0
          ? `Education: ${profile.education.map((e) => `${e.degree} ${e.field || ""} from ${e.institution}`).join("; ")}`
          : "",
        profile.skills.length > 0
          ? `Skills: ${profile.skills.map((s) => s.name).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "No profile data available.";

  const categoryInstructions = {
    full: `Generate a comprehensive interview preparation covering ALL categories:
- "technical": 5-8 questions (DSA, system design, domain-specific based on the role)
- "hr": 4-6 questions (CTC negotiation, notice period, relocation, why leaving current company — India HR round specifics)
- "behavioral": 4-6 questions (STAR method situations, leadership, conflict resolution)
- "situational": 3-4 questions (role-specific scenarios)`,
    technical: `Generate 10-12 technical interview questions:
- Data structures & algorithms relevant to the role
- System design questions appropriate for the experience level
- Domain-specific technical questions
- Coding approach / problem-solving questions
Category for all: "technical"`,
    hr: `Generate 8-10 HR round questions specific to Indian companies:
- CTC negotiation (current CTC, expected CTC, LPA format)
- Notice period handling and buyout discussions
- Reason for job change
- Company culture fit
- Relocation willingness
- Background verification expectations
- Bond/service agreement questions if applicable
Category for all: "hr"`,
    behavioral: `Generate 8-10 behavioral interview questions:
- STAR method situations (Situation, Task, Action, Result)
- Leadership and teamwork scenarios
- Conflict resolution examples
- Handling pressure and deadlines
- Adaptability and learning experiences
Category for all: "behavioral"`,
  };

  const systemPrompt = `You are an expert interview coach specializing in the Indian job market. You help candidates prepare for interviews at Indian and multinational companies operating in India.

Key India-specific considerations:
- CTC (Cost to Company) negotiations use LPA (Lakhs Per Annum) format
- Notice periods are typically 30-90 days in Indian companies; buyout negotiations are common
- HR rounds in India specifically ask about current/expected CTC, reason for change, and notice period
- Background verification is standard at Indian IT/tech companies
- Companies like TCS, Infosys, Wipro, HCL have structured interview processes
- Startups may have different patterns (culture fit, problem-solving focus)

${categoryInstructions[prepType as keyof typeof categoryInstructions]}

Return your response as valid JSON with this exact structure:
{
  "questions": [
    {
      "question": "the interview question",
      "suggestedAnswer": "a detailed suggested answer tailored to the candidate's profile",
      "category": "technical" | "hr" | "behavioral" | "situational",
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "companyInsights": "If a company name is provided, include 2-3 paragraphs about the company's interview process, culture, and what they look for. Otherwise null.",
  "tips": "5-7 bullet points of preparation tips specific to this role and interview type. Include India-specific advice."
}

Tailor suggested answers using the candidate's profile information. Be specific and actionable.`;

  const userMessage = [
    `Job Title: ${jobTitle}`,
    company ? `Company: ${company}` : "",
    jobDescription ? `Job Description:\n${jobDescription}` : "",
    `\nCandidate Profile:\n${profileContext}`,
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
      temperature: 0.4,
      max_tokens: 4000,
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

    const saved = await db.interviewPrep.create({
      data: {
        userId: session.user.id,
        jobTitle: jobTitle.trim(),
        company: company?.trim() || null,
        prepType,
        questions: JSON.stringify(parsed.questions || []),
        companyInsights: parsed.companyInsights || null,
        tips: parsed.tips || null,
      },
    });

    return NextResponse.json({
      id: saved.id,
      jobTitle: saved.jobTitle,
      company: saved.company,
      prepType: saved.prepType,
      questions: parsed.questions,
      companyInsights: parsed.companyInsights,
      tips: parsed.tips,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    console.error("Interview prep error:", error);
    return NextResponse.json(
      { error: "Failed to generate interview preparation" },
      { status: 500 }
    );
  }
}

// Get past interview preps
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preps = await db.interviewPrep.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      jobTitle: true,
      company: true,
      prepType: true,
      createdAt: true,
    },
  });

  return NextResponse.json(preps);
}
