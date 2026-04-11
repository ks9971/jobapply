import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";
import { findJobsWithEmails, scoreJobsAgainstProfile } from "@/lib/job-search";

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
- If user asks to "prepare for interview" → generate interview prep kit
- If user asks to "find jobs" or "search for jobs" → job search is triggered automatically, present the results
- If user asks to "prepare application" or "prepare for job #N" → generate full application kit (tailored CV + cover letter + email draft + talking points) for that specific job`;
}

// Detect if user wants to prepare an application (references a job number or title)
function detectPrepIntent(message: string): { isPrep: boolean; jobNumber?: number; jobTitle?: string } {
  // "prepare for job #3", "prepare application for job 3", "apply to job #5"
  const numberMatch = message.match(/(?:prepare|apply|application|materials?|kit)\s+(?:for\s+|to\s+)?(?:job\s*)?#?(\d+)/i);
  if (numberMatch) {
    return { isPrep: true, jobNumber: parseInt(numberMatch[1]) };
  }
  // "prepare for the React Developer role", "prepare for TCS job"
  const titleMatch = message.match(/(?:prepare|apply|application|materials?|kit)\s+(?:for\s+|to\s+)?(?:the\s+)?(.+?)(?:\s+(?:role|job|position|at\s+.+))?$/i);
  if (titleMatch && titleMatch[1].length > 2) {
    return { isPrep: true, jobTitle: titleMatch[1].trim() };
  }
  return { isPrep: false };
}

// Detect and handle profile update requests via chat
async function handleProfileUpdate(
  message: string,
  userId: string,
  openai: OpenAI
): Promise<{ updated: boolean; context: string }> {
  // Check if message looks like a profile update request
  const updatePatterns = [
    /(?:add|update|change|set|include)\s+(?:my\s+)?(?:skill|skills)/i,
    /(?:add|update|change)\s+(?:my\s+)?(?:experience|job|work|role|position)/i,
    /(?:add|update|change|set)\s+(?:my\s+)?(?:education|degree|college|university)/i,
    /(?:update|change|set)\s+(?:my\s+)?(?:phone|location|headline|summary|salary|notice\s*period|expected\s*salary|current\s*salary)/i,
    /(?:my\s+)?(?:new\s+)?(?:job|role|position)\s+(?:at|is|with)\s+/i,
    /(?:i\s+(?:now\s+)?(?:work|joined|started|moved)\s+(?:at|to|as))/i,
  ];

  if (!updatePatterns.some((p) => p.test(message))) {
    return { updated: false, context: "" };
  }

  // Use AI to extract structured profile data from the message
  const extractionResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract profile update data from the user's message. Return JSON with the updates to make.
Possible update types:
- {"type": "skills", "skills": [{"name": "Docker", "level": "intermediate"}, {"name": "Kubernetes", "level": "beginner"}]}
- {"type": "experience", "experience": {"company": "TCS", "title": "Senior Developer", "location": "Mumbai", "startDate": "2024-01-01", "current": true, "description": "Working on..."}}
- {"type": "education", "education": {"institution": "IIT Delhi", "degree": "B.Tech", "field": "Computer Science", "startYear": 2018, "endYear": 2022}}
- {"type": "profile", "profile": {"phone": "...", "location": "...", "headline": "...", "summary": "...", "currentSalary": "...", "expectedSalary": "...", "noticePeriod": "..."}}
- {"type": "none"} if no clear update is requested

For skill levels, use: beginner, intermediate, advanced, expert.
Only return valid JSON. If the message is ambiguous, return {"type": "none"}.`,
      },
      { role: "user", content: message },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  try {
    const update = JSON.parse(extractionResponse.choices[0].message.content!);
    if (update.type === "none") return { updated: false, context: "" };

    const profile = await db.profile.findUnique({ where: { userId } });
    if (!profile) return { updated: false, context: "\n\n[User has no profile yet. Suggest they set up their profile first on the Profile page.]" };

    let updateSummary = "";

    if (update.type === "skills" && update.skills?.length > 0) {
      for (const skill of update.skills) {
        await db.skill.create({
          data: { profileId: profile.id, name: skill.name, level: skill.level || "intermediate" },
        });
      }
      updateSummary = `Added skills: ${update.skills.map((s: { name: string; level: string }) => `${s.name} (${s.level})`).join(", ")}`;
    } else if (update.type === "experience" && update.experience) {
      const exp = update.experience;
      await db.experience.create({
        data: {
          profileId: profile.id,
          company: exp.company,
          title: exp.title,
          location: exp.location || "",
          startDate: exp.startDate ? new Date(exp.startDate) : null,
          endDate: exp.current ? null : exp.endDate ? new Date(exp.endDate) : null,
          current: exp.current || false,
          description: exp.description || "",
        },
      });
      updateSummary = `Added experience: ${exp.title} at ${exp.company}`;
    } else if (update.type === "education" && update.education) {
      const edu = update.education;
      await db.education.create({
        data: {
          profileId: profile.id,
          institution: edu.institution,
          degree: edu.degree,
          field: edu.field || "",
          startYear: edu.startYear || null,
          endYear: edu.endYear || null,
        },
      });
      updateSummary = `Added education: ${edu.degree}${edu.field ? ` in ${edu.field}` : ""} from ${edu.institution}`;
    } else if (update.type === "profile" && update.profile) {
      const data: Record<string, string> = {};
      for (const [key, value] of Object.entries(update.profile)) {
        if (value && typeof value === "string" && ["phone", "location", "headline", "summary", "currentSalary", "expectedSalary", "noticePeriod"].includes(key)) {
          data[key] = value;
        }
      }
      if (Object.keys(data).length > 0) {
        await db.profile.update({ where: { userId }, data });
        updateSummary = `Updated profile: ${Object.keys(data).join(", ")}`;
      }
    }

    if (updateSummary) {
      return {
        updated: true,
        context: `\n\n## Profile Updated Successfully\n${updateSummary}\nConfirm the update to the user and suggest any additional improvements they could make to their profile.`,
      };
    }
  } catch {
    // Extraction failed, let normal chat handle it
  }

  return { updated: false, context: "" };
}

// Detect if user wants to search for jobs
async function detectJobSearchIntent(message: string, openai: OpenAI): Promise<{ isJobSearch: boolean; query?: string; location?: string }> {
  const jobSearchPatterns = [
    /find\s+(?:me\s+)?(?:some\s+)?(.+?)\s+jobs?\s+(?:in|at|near|around)\s+(.+)/i,
    /search\s+(?:for\s+)?(.+?)\s+jobs?\s+(?:in|at|near)\s+(.+)/i,
    /(?:look|looking)\s+for\s+(.+?)\s+(?:jobs?|positions?|roles?|openings?)\s+(?:in|at|near)\s+(.+)/i,
    /find\s+(?:me\s+)?(?:some\s+)?(.+?)\s+(?:jobs?|positions?|roles?|openings?)/i,
    /search\s+(?:for\s+)?(.+?)\s+(?:jobs?|positions?|roles?|openings?)/i,
    /(?:any|show|get)\s+(.+?)\s+(?:jobs?|positions?|roles?|openings?)/i,
    /(?:look|looking)\s+for\s+(.+?)\s+(?:jobs?|positions?|roles?|openings?)/i,
  ];

  for (const pattern of jobSearchPatterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        isJobSearch: true,
        query: match[1]?.trim(),
        location: match[2]?.trim(),
      };
    }
  }

  // Use AI for ambiguous cases
  if (/jobs?|hiring|openings?|vacancies|positions?\s+(?:available|open)/i.test(message)) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Determine if the user wants to search for job listings. If yes, extract the job role/query and location. Return JSON: {"isJobSearch": true/false, "query": "role", "location": "city or null"}. Only return valid JSON.`,
        },
        { role: "user", content: message },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    try {
      return JSON.parse(response.choices[0].message.content!);
    } catch {
      return { isJobSearch: false };
    }
  }

  return { isJobSearch: false };
}

// Format job results for the AI to present in chat
function formatJobResultsForChat(jobs: Array<{ title: string; company: string; location: string; matchScore: number; matchReason: string; url: string; hasEmail: boolean; emails: string[] }>) {
  return jobs.slice(0, 10).map((job, i) => {
    const portalLinks = {
      naukri: `https://www.naukri.com/jobid?q=${encodeURIComponent(`${job.title} ${job.company}`)}`,
      linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${job.title} ${job.company}`)}&location=India`,
    };
    return `**${i + 1}. ${job.title}** at ${job.company}${job.location ? ` (${job.location})` : ""}
   Match: ${job.matchScore}% — ${job.matchReason}
   ${job.hasEmail ? `📧 Email Apply: ${job.emails.join(", ")}` : ""}
   🔗 [Naukri](${portalLinks.naukri}) | [LinkedIn](${portalLinks.linkedin})${job.url && !job.url.includes("naukri.com/jobid") ? ` | [Original](${job.url})` : ""}`;
  }).join("\n\n");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`ai-chat:${session.user.id}`, 20, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const openai = getOpenAI();

  // Save user message
  await db.chatMessage.create({
    data: { userId, role: "user", content: message },
  });

  // Get user context, chat history, and detect job search intent in parallel
  const [context, history, jobSearchIntent] = await Promise.all([
    getUserContext(userId),
    db.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    detectJobSearchIntent(message, openai),
  ]);

  const systemPrompt = buildSystemPrompt(context);

  // If job search detected, run the search pipeline
  let jobSearchContext = "";
  if (jobSearchIntent.isJobSearch && jobSearchIntent.query) {
    try {
      const jobs = await findJobsWithEmails(jobSearchIntent.query, jobSearchIntent.location);

      // Build profile summary for scoring
      const profileSummary = context.profile
        ? `${context.profile.headline || ""} | Skills: ${context.profile.skills.map((s) => s.name).join(", ")} | Experience: ${context.profile.experience.map((e) => `${e.title} at ${e.company}`).join(", ")}`
        : "No profile set up";

      const scoredJobs = await scoreJobsAgainstProfile(jobs.slice(0, 15), profileSummary);

      // Save top results to DB as SavedJob entries
      const savePromises = scoredJobs.slice(0, 10).map((job) =>
        db.savedJob.create({
          data: {
            userId,
            title: job.title,
            company: job.company,
            location: job.location || "",
            description: job.description?.substring(0, 500) || "",
            url: job.url || "",
            source: job.source || "ai_chat_search",
            hasEmail: job.hasEmail,
            emails: job.emails || [],
            matchScore: job.matchScore,
            matchReason: job.matchReason,
            searchQuery: jobSearchIntent.query!,
          },
        }).catch(() => null) // Don't fail if save errors
      );
      await Promise.all(savePromises);

      // Format results for AI context
      const formattedJobs = formatJobResultsForChat(scoredJobs);
      jobSearchContext = `\n\n## Job Search Results\nThe user asked to find "${jobSearchIntent.query}"${jobSearchIntent.location ? ` in ${jobSearchIntent.location}` : ""} jobs. Here are the results scored against their profile:\n\n${formattedJobs}\n\nPresent these results conversationally. Highlight the best matches, mention which ones have email-apply options, and recommend which to apply to based on their profile. The results have been saved to their account — mention they can find them in the Jobs page too.`;
    } catch (error) {
      jobSearchContext = `\n\n[Job search for "${jobSearchIntent.query}" failed: ${error instanceof Error ? error.message : "Unknown error"}. Let the user know and suggest they try the Jobs page directly.]`;
    }
  }

  // If application prep detected, fetch saved job context
  let prepContext = "";
  const prepIntent = detectPrepIntent(message);
  if (prepIntent.isPrep) {
    try {
      const recentSavedJobs = await db.savedJob.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 15,
      });

      let targetJob = null;
      if (prepIntent.jobNumber && recentSavedJobs[prepIntent.jobNumber - 1]) {
        targetJob = recentSavedJobs[prepIntent.jobNumber - 1];
      } else if (prepIntent.jobTitle) {
        const searchTerm = prepIntent.jobTitle.toLowerCase();
        targetJob = recentSavedJobs.find(
          (j) => j.title.toLowerCase().includes(searchTerm) || j.company.toLowerCase().includes(searchTerm)
        );
      }

      if (targetJob) {
        prepContext = `\n\n## Application Prep Request\nThe user wants to prepare application materials for:\n**${targetJob.title}** at **${targetJob.company}**${targetJob.location ? ` (${targetJob.location})` : ""}\nJob Description: ${targetJob.description || "Not available"}\nMatch Score: ${targetJob.matchScore || "Not scored"}%\n${targetJob.hasEmail ? `Email contacts: ${targetJob.emails.join(", ")}` : ""}\n\nGenerate a COMPLETE application kit:\n1. **Tailored CV** in markdown — reorder skills to match this role, emphasize relevant experience, ATS-optimized\n2. **Cover Letter** — specific to this role and company, reference actual skills/experience\n3. **Application Email** — short, professional email to send with the application (include Subject line)\n4. **Key Talking Points** — 3-5 bullet points to highlight in any conversation about this role\n\nUse the user's actual profile data. Be specific, not generic.`;
      } else {
        prepContext = `\n\n## Application Prep Request\nThe user wants to prepare application materials but no matching saved job was found. Show them their recent saved jobs and ask which one they'd like to prepare for. Their recent jobs: ${recentSavedJobs.slice(0, 5).map((j, i) => `${i + 1}. ${j.title} at ${j.company}`).join(", ")}`;
      }
    } catch {
      // Ignore prep context errors
    }
  }

  // If profile update detected, handle it
  let profileUpdateContext = "";
  if (!jobSearchIntent.isJobSearch && !prepIntent.isPrep) {
    const profileUpdate = await handleProfileUpdate(message, userId, openai);
    if (profileUpdate.updated) {
      profileUpdateContext = profileUpdate.context;
    }
  }

  // Build messages array with history
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt + jobSearchContext + prepContext + profileUpdateContext },
  ];

  // Add recent history (skip the message we just saved — it's the current one)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Generate AI response (higher token limit for prep/CV generation)
  const needsLongResponse = prepIntent.isPrep || /generate\s+cv|create\s+resume|write\s+cover\s+letter/i.test(message);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: needsLongResponse ? 8000 : 4000,
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
