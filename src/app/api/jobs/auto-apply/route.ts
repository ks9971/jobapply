import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/gmail";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Auto-apply to a specific job
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId, email, customMessage } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Check Gmail connected
  const gmailToken = await db.gmailToken.findUnique({ where: { userId } });
  if (!gmailToken) {
    return NextResponse.json({ error: "Gmail not connected. Go to Settings to connect." }, { status: 400 });
  }

  // Get job details
  let jobTitle = "the position";
  let jobCompany = "your company";
  let jobDescription = "";

  if (jobId) {
    const job = await db.savedJob.findUnique({ where: { id: jobId } });
    if (job) {
      jobTitle = job.title;
      jobCompany = job.company;
      jobDescription = job.description || "";
    }
  }

  // Get user profile
  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: true, education: true },
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

  // Generate tailored CV + cover letter + email body in parallel
  const [cvResponse, emailBodyResponse] = await Promise.all([
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Create a professional, ATS-friendly resume tailored for the specific job. Use markdown format.
Sections: Contact Info, Professional Summary, Work Experience, Education, Skills.
Reorder skills to match job requirements. Emphasize relevant experience. Use action verbs, quantify achievements.`,
        },
        {
          role: "user",
          content: `Profile: ${JSON.stringify(profileData)}\n\nJob: ${jobTitle} at ${jobCompany}\n\nDescription: ${jobDescription}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 2500,
    }),
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Write a professional job application email. Keep it concise (under 200 words).
Include:
- Professional greeting
- Which position you're applying for
- 2-3 sentences on why you're a great fit (specific to the job)
- Mention attached resume
- Professional sign-off with candidate's name and phone number

Do NOT include a subject line. Just the email body.
Be warm but professional. Not generic — reference specific skills that match the job.`,
        },
        {
          role: "user",
          content: `${customMessage ? `User's additional note: ${customMessage}\n\n` : ""}Candidate: ${user?.name}, ${profile.headline || "Professional"}
Phone: ${profile.phone || ""}
Key skills: ${profile.skills.slice(0, 8).map((s) => s.name).join(", ")}
Latest role: ${profile.experience[0] ? `${profile.experience[0].title} at ${profile.experience[0].company}` : "N/A"}

Applying for: ${jobTitle} at ${jobCompany}
Job Description: ${jobDescription.substring(0, 1000)}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  ]);

  const tailoredCV = cvResponse.choices[0].message.content!;
  const emailBody = emailBodyResponse.choices[0].message.content!;
  const subject = `Application for ${jobTitle} — ${user?.name || "Experienced Professional"}`;

  try {
    // Send the email via Gmail
    await sendEmail(userId, email, subject, emailBody);

    // Save CV document
    await db.cVDocument.create({
      data: {
        userId,
        filename: `tailored-cv-${jobCompany.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.md`,
        filePath: "",
        fileType: "generated",
        fileContent: tailoredCV,
      },
    });

    // Create application tracking entry
    const application = await db.application.create({
      data: {
        userId,
        jobTitle,
        company: jobCompany,
        portal: "email",
        status: "applied",
        coverLetter: emailBody,
        tailoredCV,
        notes: `Auto-applied via email to ${email}`,
      },
    });

    // Update saved job status if applicable
    if (jobId) {
      await db.savedJob.update({
        where: { id: jobId },
        data: { status: "applied" },
      });
    }

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      sentTo: email,
      subject,
      emailPreview: emailBody.substring(0, 200) + "...",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
