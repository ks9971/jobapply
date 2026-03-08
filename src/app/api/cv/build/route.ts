import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCV } from "@/lib/ai/cv-builder";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetRole, jobDescription, style, emphasis } = await req.json();

  // Get user's full profile
  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      education: true,
      experience: { orderBy: { startDate: "desc" } },
      skills: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found. Please fill in your profile first." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });

  const profileData = {
    name: user?.name,
    email: user?.email,
    phone: profile.phone,
    location: profile.location,
    headline: profile.headline,
    summary: profile.summary,
    education: profile.education,
    experience: profile.experience,
    skills: profile.skills.map((s) => ({ name: s.name, level: s.level })),
  };

  const cvContent = await buildCV({
    profileData,
    targetRole,
    jobDescription,
    style,
    emphasis,
  });

  // Save the generated CV
  const uploadDir = path.join(process.cwd(), "uploads", session.user.id);
  await mkdir(uploadDir, { recursive: true });

  const filename = `generated-cv-${Date.now()}.md`;
  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, cvContent);

  const cvDocument = await db.cVDocument.create({
    data: {
      userId: session.user.id,
      filename,
      filePath,
      fileType: "generated",
    },
  });

  return NextResponse.json({ content: cvContent, document: cvDocument });
}
