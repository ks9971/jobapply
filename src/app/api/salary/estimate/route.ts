import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  const { success } = rateLimit(`salary:${session.user.id}`, 10, 60000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { role, city, experienceYears } = await req.json();
  if (!role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an Indian salary expert. Given a job role, city, and experience level, estimate the CTC salary range in LPA (Lakhs Per Annum) for the Indian market.

Return JSON:
{
  "role": "exact role name",
  "city": "city",
  "experience": "X years",
  "ranges": {
    "startup": {"min": 0, "max": 0, "median": 0},
    "midsize": {"min": 0, "max": 0, "median": 0},
    "mnc": {"min": 0, "max": 0, "median": 0},
    "faang": {"min": 0, "max": 0, "median": 0}
  },
  "inHandBreakdown": {
    "ctc": 0,
    "basic": 0,
    "hra": 0,
    "specialAllowance": 0,
    "pf": 0,
    "professionalTax": 200,
    "incomeTax": 0,
    "monthlyInHand": 0
  },
  "marketInsights": [
    "insight 1 about this role's market demand",
    "insight 2 about salary trends"
  ],
  "negotiationTips": [
    "tip 1 for salary negotiation",
    "tip 2"
  ]
}

All salary figures should be in LPA (Lakhs Per Annum). The inHandBreakdown should use the median MNC CTC.
Calculate approximate in-hand based on Indian tax structure:
- Basic = 40% of CTC
- HRA = 50% of Basic (metros) or 40% (non-metros)
- PF = 12% of Basic (capped at 1800/month for employer)
- Professional Tax = ~200/month
- Income tax based on new regime slabs

Be realistic with 2024-25 Indian market rates. Only return valid JSON.`,
      },
      {
        role: "user",
        content: `Role: ${role}\nCity: ${city || "Bangalore"}\nExperience: ${experienceYears || 3} years`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  try {
    const data = JSON.parse(response.choices[0].message.content!);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to generate salary estimate" }, { status: 500 });
  }
}
