import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function getUserContext(userId: string) {
  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({
      where: { userId },
      include: {
        education: true,
        experience: { orderBy: { startDate: "desc" } },
        skills: true,
        jobPreference: true,
      },
    }),
  ]);

  const [applicationCount, applications] = await Promise.all([
    db.application.count({ where: { userId } }),
    db.application.findMany({
      where: { userId },
      orderBy: { appliedAt: "desc" },
      take: 10,
    }),
  ]);

  return { user, profile, applicationCount, recentApplications: applications };
}

function buildSystemPrompt(context: Awaited<ReturnType<typeof getUserContext>>) {
  const { user, profile, applicationCount, recentApplications } = context;

  const profileSummary = profile
    ? `
Name: ${user?.name || "Not set"}
Email: ${user?.email || "Not set"}
Phone: ${profile.phone || "Not set"}
Location: ${profile.location || "Not set"}
Headline: ${profile.headline || "Not set"}
Summary: ${profile.summary || "Not set"}
Total Experience: ${profile.totalExperience ? `${profile.totalExperience} months` : "Not set"}
Current Salary: ${profile.currentSalary || "Not set"}
Expected Salary: ${profile.expectedSalary || "Not set"}
Notice Period: ${profile.noticePeriod || "Not set"}

Education:
${profile.education.length > 0 ? profile.education.map((e) => `- ${e.degree} ${e.field ? `in ${e.field}` : ""} from ${e.institution} (${e.startYear || "?"}-${e.endYear || "Present"})`).join("\n") : "None added"}

Experience:
${profile.experience.length > 0 ? profile.experience.map((e) => `- ${e.title} at ${e.company} (${e.startDate ? new Date(e.startDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "?"} - ${e.current ? "Present" : e.endDate ? new Date(e.endDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "?"}): ${e.description || "No description"}`).join("\n") : "None added"}

Skills:
${profile.skills.length > 0 ? profile.skills.map((s) => `- ${s.name} (${s.level})`).join("\n") : "None added"}

Job Preferences:
${profile.jobPreference ? `Roles: ${profile.jobPreference.roles}, Locations: ${profile.jobPreference.locations}, Salary: ${profile.jobPreference.minSalary || "?"}-${profile.jobPreference.maxSalary || "?"}, Remote: ${profile.jobPreference.remote}` : "Not set"}
`
    : "Profile is empty - user hasn't set up their profile yet.";

  const applicationSummary =
    applicationCount > 0
      ? `
Applications: ${applicationCount} total
Recent: ${recentApplications.map((a) => `${a.jobTitle} at ${a.company} (${a.status})`).join(", ")}
`
      : "No applications yet.";

  return `You are JobApply AI — a powerful career assistant that helps users land their dream jobs. You have full access to the user's profile and can help them with ANYTHING career-related.

## User's Current Profile:
${profileSummary}

## Application Status:
${applicationSummary}

## Your Capabilities:
1. **Profile Building**: Help users build/improve their profile through conversation. When they tell you about their experience, skills, or education, acknowledge it and let them know it can be saved.
2. **CV Generation**: Generate tailored CVs for specific job roles. When asked, create a professional CV in markdown format.
3. **Cover Letter Writing**: Write personalized cover letters for specific jobs.
4. **Job Description Analysis**: When a user pastes a job description, analyze it and provide:
   - Match score (percentage) against their profile
   - What matches well
   - What's missing/gaps
   - Tailored CV adjustments
   - Interview preparation tips
5. **Career Advice**: Give honest, actionable career advice based on their profile.
6. **Interview Prep**: Generate likely interview questions and suggested answers.
7. **Profile Review**: Analyze their profile and suggest improvements.

## Important Rules:
- Be conversational but professional. Not too formal, not too casual.
- Give SPECIFIC, ACTIONABLE advice — not generic platitudes.
- When analyzing a job description, be thorough and honest about gaps.
- When generating CVs or cover letters, make them genuinely good — ATS-friendly, quantified achievements, action verbs.
- If the user's profile is empty or incomplete, guide them to set it up. Suggest uploading their CV for quick setup.
- Always be encouraging but honest. Don't sugarcoat if their profile has gaps.
- Keep responses concise. Don't write essays unless generating a CV/cover letter.
- Use markdown formatting for structure when helpful.

## Special Commands (detect these intents):
- If user asks to "analyze" or "review" a job description → do full match analysis
- If user asks to "generate CV" or "create resume" → generate tailored markdown CV
- If user asks to "write cover letter" → generate cover letter
- If user asks "what should I improve" → give profile improvement suggestions
- If user asks to "prepare for interview" → generate interview prep kit`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Save user message
  await db.chatMessage.create({
    data: { userId, role: "user", content: message },
  });

  // Get user context and chat history
  const [context, history] = await Promise.all([
    getUserContext(userId),
    db.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 50, // Last 50 messages for context
    }),
  ]);

  const systemPrompt = buildSystemPrompt(context);

  // Build messages array with history
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add recent history (skip the message we just saved — it's the current one)
  const recentHistory = history.slice(-20); // Last 20 for API call
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Generate AI response
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 4000,
  });

  const assistantMessage = response.choices[0].message.content!;

  // Save assistant message
  await db.chatMessage.create({
    data: { userId, role: "assistant", content: assistantMessage },
  });

  return NextResponse.json({ message: assistantMessage });
}

// Get chat history
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await db.chatMessage.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

// Clear chat history
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.chatMessage.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ message: "Chat history cleared" });
}
