import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ParsedCV {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  education: {
    institution: string;
    degree: string;
    field: string;
    startYear: number;
    endYear: number;
    grade: string;
  }[];
  experience: {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  }[];
  skills: { name: string; level: string }[];
}

export async function parseCV(text: string): Promise<ParsedCV> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a CV/resume parser. Extract structured data from the given resume text.
Return a JSON object with the following structure:
{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "headline": string (professional title/headline),
  "summary": string,
  "education": [{ "institution": string, "degree": string, "field": string, "startYear": number, "endYear": number, "grade": string }],
  "experience": [{ "company": string, "title": string, "location": string, "startDate": "YYYY-MM", "endDate": "YYYY-MM", "current": boolean, "description": string }],
  "skills": [{ "name": string, "level": "beginner" | "intermediate" | "expert" }]
}
Return ONLY valid JSON, no markdown or explanations.`,
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return JSON.parse(response.choices[0].message.content!) as ParsedCV;
}
