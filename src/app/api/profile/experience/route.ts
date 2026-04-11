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
  const experience = await db.experience.create({
    data: {
      profileId: profile.id,
      company: data.company,
      title: data.title,
      location: data.location,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.current ? null : data.endDate ? new Date(data.endDate) : null,
      current: data.current || false,
      description: data.description,
    },
  });

  return NextResponse.json(experience, { status: 201 });
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

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const record = await db.experience.findFirst({ where: { id, profileId: profile.id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.experience.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
