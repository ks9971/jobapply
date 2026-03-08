import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const data = await req.json();
  const education = await db.education.create({
    data: {
      profileId: profile.id,
      institution: data.institution,
      degree: data.degree,
      field: data.field,
      startYear: data.startYear ? parseInt(data.startYear) : null,
      endYear: data.endYear ? parseInt(data.endYear) : null,
      grade: data.grade,
    },
  });

  return NextResponse.json(education, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await db.education.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
