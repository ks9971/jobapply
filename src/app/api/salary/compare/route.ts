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

  const { success } = rateLimit(`salary-compare:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { currentCTC, role, city, experienceYears } = await req.json();

  // If no params, pull from profile
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: { skills: true, experience: { orderBy: { startDate: "desc" }, take: 1 } },
  });

  const effectiveRole = role || profile?.headline || profile?.experience[0]?.title || "Software Developer";
  const effectiveCity = city || profile?.location || "Bangalore";
  const effectiveExp = experienceYears || (profile?.totalExperience ? Math.round(profile.totalExperience / 12) : 3);
  const effectiveCTC = currentCTC || profile?.currentSalary || null;

  if (!effectiveCTC) {
    return NextResponse.json({ error: "Current CTC is required. Set it in your profile or pass it in the request." }, { status: 400 });
  }

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an Indian salary comparison expert. Compare the user's current CTC against market rates.

Return JSON:
{
  "currentCTC": "X LPA",
  "marketMedian": "X LPA",
  "percentile": 0-100,
  "verdict": "underpaid" | "fair" | "well-paid" | "above-market",
  "gap": "+X LPA" or "-X LPA",
  "recommendation": "Honest recommendation about their salary position",
  "expectedHike": {
    "sameCompany": "X-Y%",
    "jobSwitch": "X-Y%",
    "targetCTC": "X-Y LPA"
  },
  "factors": [
    "factor that could increase their market value",
    "factor that could affect their salary"
  ]
}

Be honest and specific. Use 2024-25 Indian market data. Only return valid JSON.`,
      },
      {
        role: "user",
        content: `Current CTC: ${effectiveCTC} LPA\nRole: ${effectiveRole}\nCity: ${effectiveCity}\nExperience: ${effectiveExp} years\nSkills: ${profile?.skills.map((s) => s.name).join(", ") || "Not specified"}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const data = JSON.parse(response.choices[0].message.content!);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to generate comparison" }, { status: 500 });
  }
}
