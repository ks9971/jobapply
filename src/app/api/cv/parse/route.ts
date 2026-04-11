import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await req.json();

  const doc = await db.cVDocument.findUnique({
    where: { id: documentId, userId: session.user.id },
  });

  if (!doc || !doc.fileContent) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Decode base64 content and parse PDF
  const fileBuffer = Buffer.from(doc.fileContent, "base64");
  const pdfData = await pdfParse(fileBuffer);
  const text = pdfData.text;

  if (!text || text.trim().length < 20) {
    return NextResponse.json({ error: "Could not extract text from PDF. The file may be image-based." }, { status: 400 });
  }

  // Use AI to extract structured data
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract structured data from this CV/resume text. Return a JSON object with these fields:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "headline": "string (professional title like 'Senior Software Engineer')",
  "summary": "string (2-3 sentence professional summary)",
  "skills": [{"name": "string", "level": "beginner|intermediate|expert"}],
  "experience": [{"company": "string", "title": "string", "location": "string", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "current": boolean, "description": "string"}],
  "education": [{"institution": "string", "degree": "string", "field": "string", "startYear": number, "endYear": number, "grade": "string"}]
}
For skill levels: if the person has 3+ years with a skill or it appears prominently, mark as "expert". 1-3 years or moderate mention as "intermediate". Otherwise "beginner".
Only return valid JSON, no markdown or extra text.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  let parsedData;
  try {
    parsedData = JSON.parse(response.choices[0].message.content!);
  } catch {
    return NextResponse.json({ error: "Failed to parse CV data" }, { status: 500 });
  }

  // Save parsed data to the document
  await db.cVDocument.update({
    where: { id: documentId },
    data: { parsedData: JSON.stringify(parsedData) },
  });

  // Auto-import to profile
  const userId = session.user.id;

  if (parsedData.name) {
    await db.user.update({
      where: { id: userId },
      data: { name: parsedData.name },
    });
  }

  const profile = await db.profile.upsert({
    where: { userId },
    update: {
      phone: parsedData.phone || undefined,
      location: parsedData.location || undefined,
      headline: parsedData.headline || undefined,
      summary: parsedData.summary || undefined,
    },
    create: {
      userId,
      phone: parsedData.phone || null,
      location: parsedData.location || null,
      headline: parsedData.headline || null,
      summary: parsedData.summary || null,
    },
  });

  // Import education
  if (parsedData.education?.length > 0) {
    await db.education.deleteMany({ where: { profileId: profile.id } });
    for (const edu of parsedData.education) {
      await db.education.create({
        data: {
          profileId: profile.id,
          institution: edu.institution || "Unknown",
          degree: edu.degree || "Unknown",
          field: edu.field || null,
          startYear: edu.startYear ? parseInt(String(edu.startYear)) || null : null,
          endYear: edu.endYear ? parseInt(String(edu.endYear)) || null : null,
          grade: edu.grade || null,
        },
      });
    }
  }

  // Import experience
  if (parsedData.experience?.length > 0) {
    await db.experience.deleteMany({ where: { profileId: profile.id } });
    for (const exp of parsedData.experience) {
      await db.experience.create({
        data: {
          profileId: profile.id,
          company: exp.company || "Unknown",
          title: exp.title || "Unknown",
          location: exp.location || null,
          startDate: exp.startDate ? new Date(exp.startDate) : null,
          endDate: exp.endDate ? new Date(exp.endDate) : null,
          current: exp.current || false,
          description: exp.description || null,
        },
      });
    }
  }

  // Import skills
  if (parsedData.skills?.length > 0) {
    await db.skill.deleteMany({ where: { profileId: profile.id } });
    for (const skill of parsedData.skills) {
      await db.skill.create({
        data: {
          profileId: profile.id,
          name: skill.name,
          level: skill.level || "intermediate",
        },
      });
    }
  }

  // Mark user as onboarded
  await db.user.update({
    where: { id: userId },
    data: { onboarded: true },
  });

  return NextResponse.json({
    parsedData,
    imported: true,
    message: "CV parsed and profile updated automatically",
  });
}
