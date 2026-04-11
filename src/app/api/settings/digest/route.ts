import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { digestEnabled: true, digestTime: true, lastDigestAt: true },
  });

  return NextResponse.json({
    digestEnabled: user?.digestEnabled || false,
    digestTime: user?.digestTime || "09:00",
    lastDigestAt: user?.lastDigestAt,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { digestEnabled, digestTime } = await req.json();

  await db.user.update({
    where: { id: session.user.id },
    data: {
      digestEnabled: !!digestEnabled,
      ...(digestTime && { digestTime }),
    },
  });

  return NextResponse.json({ success: true });
}
