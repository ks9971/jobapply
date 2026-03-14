import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { parsedData } = await req.json();
  if (!parsedData) {
    return NextResponse.json({ error: "No parsed data provided" }, { status: 400 });
  }

  const userId = session.user.id;

  // Update user name if extracted
  if (parsedData.name) {
    await db.user.update({
      where: { id: userId },
      data: { name: parsedData.name },
    });
  }

  // Upsert profile with basic info
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

  // Import education (clear existing and re-import)
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

  // Import experience (clear existing and re-import)
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

  // Import skills (clear existing and re-import)
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
    message: "Profile imported successfully",
    imported: {
      education: parsedData.education?.length || 0,
      experience: parsedData.experience?.length || 0,
      skills: parsedData.skills?.length || 0,
    },
  });
}
