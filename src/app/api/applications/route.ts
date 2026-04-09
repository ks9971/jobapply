import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await db.application.findMany({
    where: { userId: session.user.id },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(applications);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  const application = await db.application.create({
    data: {
      userId: session.user.id,
      jobTitle: data.jobTitle,
      company: data.company,
      jobUrl: data.jobUrl,
      portal: data.portal || "manual",
      status: data.status || "applied",
      notes: data.notes,
    },
  });

  // Auto-create follow-up reminders
  const now = new Date();
  await db.reminder.createMany({
    data: [
      {
        userId: session.user.id,
        applicationId: application.id,
        type: "follow_up",
        message: `Follow up on ${data.jobTitle} at ${data.company} (1 week since applying)`,
        dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: session.user.id,
        applicationId: application.id,
        type: "follow_up",
        message: `Second follow-up on ${data.jobTitle} at ${data.company} (2 weeks since applying)`,
        dueAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  return NextResponse.json(application, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  const application = await db.application.update({
    where: { id: data.id },
    data: {
      status: data.status,
      notes: data.notes,
    },
  });

  return NextResponse.json(application);
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

  await db.application.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
