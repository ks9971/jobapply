import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobDescription, jobTitle, company } = await req.json();
  if (!jobDescription) {
    return NextResponse.json({ error: "Job description is required" }, { status: 400 });
  }

  const userId = session.user.id;

  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({
      where: { userId },
      include: {
        education: true,
        experience: { orderBy: { startDate: "desc" } },
        skills: true,
      },
    }),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Please set up your profile first" }, { status: 400 });
  }

  const profileData = {
    name: user?.name,
    email: user?.email,
    phone: profile.phone,
    location: profile.location,
    headline: profile.headline,
    summary: profile.summary,
    education: profile.education,
    experience: profile.experience,
    skills: profile.skills,
  };

  const openai = getOpenAI();

  // Generate tailored CV + cover letter + email draft in parallel
  const [cvResponse, coverLetterResponse, emailResponse] = await Promise.all([
    // Tailored CV
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional CV writer. Create an ATS-friendly resume TAILORED for the specific job.
Reorder skills to match job requirements. Rewrite the summary to target this role. Emphasize relevant experience.
Use action verbs, quantify achievements. Output in clean markdown format.
Sections: Contact Info, Professional Summary, Work Experience, Education, Skills.`,
        },
        {
          role: "user",
          content: `Profile: ${JSON.stringify(profileData)}\n\nJob: ${jobTitle || "the role"} at ${company || "the company"}\n\nJob Description: ${jobDescription}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 3000,
    }),
    // Cover Letter
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Write a professional, compelling cover letter for a job application.
Be specific — reference actual skills and experience from the candidate's profile.
Reference specific requirements from the job description.
Keep it concise (3-4 paragraphs). Professional but not stuffy.
Format: proper letter format with greeting and sign-off.
Use the candidate's actual name.`,
        },
        {
          role: "user",
          content: `Candidate: ${JSON.stringify(profileData)}\n\nApplying for: ${jobTitle || "the role"} at ${company || "the company"}\n\nJob Description: ${jobDescription}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
    // Application Email Draft
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Write a short, professional application email that the candidate can send to the hiring manager.
Include: subject line (on first line, prefixed with "Subject: "), brief body expressing interest, mention of attached CV and cover letter.
Keep it under 150 words. Professional, concise, direct.`,
        },
        {
          role: "user",
          content: `Candidate: ${user?.name} applying for ${jobTitle || "the role"} at ${company || "the company"}.\nKey strengths: ${profile.skills.slice(0, 5).map((s) => s.name).join(", ")}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 500,
    }),
  ]);

  const tailoredCV = cvResponse.choices[0].message.content!;
  const coverLetter = coverLetterResponse.choices[0].message.content!;
  const emailDraft = emailResponse.choices[0].message.content!;

  // Save the generated CV
  const cvDocument = await db.cVDocument.create({
    data: {
      userId,
      filename: `tailored-cv-${company || "job"}-${Date.now()}.md`,
      filePath: "",
      fileType: "generated",
      fileContent: tailoredCV,
    },
  });

  // Auto-create application tracking entry
  const application = await db.application.create({
    data: {
      userId,
      jobTitle: jobTitle || "Unknown Role",
      company: company || "Unknown Company",
      portal: "direct",
      status: "applied",
      coverLetter,
      tailoredCV,
      notes: `AI-generated apply kit. Match analysis completed.`,
    },
  });

  return NextResponse.json({
    tailoredCV,
    coverLetter,
    emailDraft,
    cvDocumentId: cvDocument.id,
    applicationId: application.id,
  });
}
