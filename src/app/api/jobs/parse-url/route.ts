import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Fetch page content and extract text
async function fetchPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`);

  const html = await res.text();
  // Strip HTML tags, scripts, styles — get clean text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  // Limit to ~8000 chars for AI processing
  return text.substring(0, 8000);
}

// Detect which portal the URL is from
function detectPortal(url: string): string {
  if (url.includes("naukri.com")) return "naukri";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("instahyre.com")) return "instahyre";
  if (url.includes("cutshort.io")) return "cutshort";
  return "other";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`parse-url:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { url } = await req.json();
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const userId = session.user.id;
  const portal = detectPortal(url);

  try {
    // Fetch page content
    const pageText = await fetchPageContent(url);

    if (pageText.length < 50) {
      return NextResponse.json({ error: "Could not extract content from URL" }, { status: 400 });
    }

    // Use AI to extract structured job data
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract job listing details from the page text. Return JSON:
{
  "jobTitle": "exact job title",
  "company": "company name",
  "location": "city/location",
  "description": "full job description (responsibilities, requirements, etc.)",
  "requirements": ["requirement 1", "requirement 2", ...],
  "salary": "salary range if mentioned (in LPA if Indian)",
  "experience": "experience required (e.g. '3-5 years')",
  "skills": ["skill1", "skill2", ...],
  "jobType": "full-time/part-time/contract/remote",
  "postedDate": "when posted if available"
}
Fill in what you can find. Use null for missing fields. Only return valid JSON.`,
        },
        { role: "user", content: `URL: ${url}\nPortal: ${portal}\n\nPage Content:\n${pageText}` },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    let jobData;
    try {
      jobData = JSON.parse(response.choices[0].message.content!);
    } catch {
      return NextResponse.json({ error: "Failed to parse job data" }, { status: 500 });
    }

    // Also run ATS score if user has a profile
    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: { take: 3 } },
    });

    let atsScore = null;
    if (profile && jobData.description) {
      const profileSummary = `${profile.headline || ""} | Skills: ${profile.skills.map((s) => s.name).join(", ")} | Experience: ${profile.experience.map((e) => `${e.title} at ${e.company}`).join(", ")}`;

      const atsResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Score how well this candidate matches the job. Return JSON: {"score": 0-100, "matchingSkills": [...], "missingSkills": [...], "suggestions": ["suggestion1", ...]}. Be honest.`,
          },
          {
            role: "user",
            content: `Candidate: ${profileSummary}\n\nJob: ${jobData.jobTitle} at ${jobData.company}\nDescription: ${jobData.description}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      try {
        atsScore = JSON.parse(atsResponse.choices[0].message.content!);
      } catch {
        // ATS scoring failed, continue without it
      }
    }

    return NextResponse.json({
      ...jobData,
      url,
      portal,
      atsScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
