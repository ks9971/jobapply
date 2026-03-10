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
  "headline": "string",
  "summary": "string",
  "skills": [{"name": "string", "level": "beginner|intermediate|expert"}],
  "experience": [{"company": "string", "title": "string", "location": "string", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "current": boolean, "description": "string"}],
  "education": [{"institution": "string", "degree": "string", "field": "string", "startYear": number, "endYear": number, "grade": "string"}]
}
Only return valid JSON, no markdown or extra text.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const parsedData = JSON.parse(response.choices[0].message.content!);

  // Update the document with parsed data
  await db.cVDocument.update({
    where: { id: documentId },
    data: { parsedData: JSON.stringify(parsedData) },
  });

  return NextResponse.json({ parsedData });
}
