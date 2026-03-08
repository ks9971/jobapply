import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CVBuildRequest {
  profileData: Record<string, unknown>;
  targetRole?: string;
  jobDescription?: string;
  style?: "professional" | "modern" | "minimal" | "creative";
  emphasis?: string[]; // e.g., ["technical skills", "leadership", "projects"]
}

export async function buildCV(request: CVBuildRequest): Promise<string> {
  const { profileData, targetRole, jobDescription, style = "professional", emphasis } = request;

  const systemPrompt = `You are a professional CV/resume writer. Create a polished, ATS-friendly resume.
Style: ${style}
${targetRole ? `Target role: ${targetRole}` : ""}
${emphasis ? `Emphasize: ${emphasis.join(", ")}` : ""}
${jobDescription ? `Tailor the CV for this job description: ${jobDescription}` : ""}

Output the CV in clean, well-structured markdown format with clear sections:
- Contact Information
- Professional Summary
- Work Experience (reverse chronological)
- Education
- Skills
- Certifications (if applicable)

Use action verbs, quantify achievements where possible, and keep it concise (2 pages max).`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Build a resume from this profile data:\n${JSON.stringify(profileData, null, 2)}` },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  return response.choices[0].message.content!;
}
