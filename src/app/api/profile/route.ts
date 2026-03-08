import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      education: true,
      experience: { orderBy: { startDate: "desc" } },
      skills: true,
      jobPreference: true,
    },
  });

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  const profile = await db.profile.upsert({
    where: { userId: session.user.id },
    update: {
      phone: data.phone,
      location: data.location,
      headline: data.headline,
      summary: data.summary,
      totalExperience: data.totalExperience,
      currentSalary: data.currentSalary,
      expectedSalary: data.expectedSalary,
      noticePeriod: data.noticePeriod,
    },
    create: {
      userId: session.user.id,
      phone: data.phone,
      location: data.location,
      headline: data.headline,
      summary: data.summary,
      totalExperience: data.totalExperience,
      currentSalary: data.currentSalary,
      expectedSalary: data.expectedSalary,
      noticePeriod: data.noticePeriod,
    },
  });

  return NextResponse.json(profile);
}
