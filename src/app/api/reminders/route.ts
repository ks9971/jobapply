import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Get reminders (upcoming by default, or all)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "upcoming"; // upcoming, all, overdue

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let where: Record<string, unknown> = { userId: session.user.id };

  if (filter === "upcoming") {
    where = {
      ...where,
      isDone: false,
      dueAt: { lte: threeDaysFromNow },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    };
  } else if (filter === "overdue") {
    where = {
      ...where,
      isDone: false,
      dueAt: { lt: now },
    };
  } else {
    // all - just filter by user
  }

  const reminders = await db.reminder.findMany({
    where,
    orderBy: { dueAt: "asc" },
    take: 50,
  });

  // Enrich with application details
  const applicationIds = reminders
    .map((r) => r.applicationId)
    .filter(Boolean) as string[];

  const applications =
    applicationIds.length > 0
      ? await db.application.findMany({
          where: { id: { in: applicationIds } },
          select: { id: true, jobTitle: true, company: true, status: true },
        })
      : [];

  const appMap = new Map(applications.map((a) => [a.id, a]));

  const enriched = reminders.map((r) => ({
    ...r,
    application: r.applicationId ? appMap.get(r.applicationId) || null : null,
  }));

  return NextResponse.json(enriched);
}

// Create a reminder
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applicationId, type, message, dueAt } = await req.json();

  if (!message?.trim() || !dueAt) {
    return NextResponse.json(
      { error: "Message and due date are required" },
      { status: 400 }
    );
  }

  const reminder = await db.reminder.create({
    data: {
      userId: session.user.id,
      applicationId: applicationId || null,
      type: type || "follow_up",
      message,
      dueAt: new Date(dueAt),
    },
  });

  return NextResponse.json(reminder);
}

// Update a reminder (mark done, snooze)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, isDone, snoozeDays } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Reminder ID is required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await db.reminder.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (isDone !== undefined) {
    updateData.isDone = isDone;
  }

  if (snoozeDays) {
    updateData.snoozedUntil = new Date(
      Date.now() + snoozeDays * 24 * 60 * 60 * 1000
    );
  }

  const updated = await db.reminder.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

// Delete a reminder
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Reminder ID is required" }, { status: 400 });
  }

  const existing = await db.reminder.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  await db.reminder.delete({ where: { id } });

  return NextResponse.json({ message: "Reminder deleted" });
}
