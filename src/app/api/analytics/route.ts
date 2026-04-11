import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`analytics:${session.user.id}`, 30, 60_000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userId = session.user.id;

  const applications = await db.application.findMany({
    where: { userId },
    orderBy: { appliedAt: "desc" },
  });

  const now = new Date();

  // --- Overview ---
  const totalApplications = applications.length;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisWeek = applications.filter(
    (a) => a.appliedAt && new Date(a.appliedAt) >= startOfWeek
  ).length;

  const thisMonth = applications.filter(
    (a) => a.appliedAt && new Date(a.appliedAt) >= startOfMonth
  ).length;

  const responded = applications.filter(
    (a) => a.status && a.status !== "applied"
  ).length;
  const responseRate =
    totalApplications > 0
      ? Math.round((responded / totalApplications) * 100)
      : 0;

  // --- Funnel ---
  const statusCounts: Record<string, number> = {};
  for (const a of applications) {
    const s = (a.status || "applied").toLowerCase();
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const funnel = {
    applied: statusCounts["applied"] || 0,
    screening: statusCounts["screening"] || 0,
    interview: statusCounts["interview"] || 0,
    offer: statusCounts["offer"] || 0,
    rejected: statusCounts["rejected"] || 0,
  };

  // --- Weekly Volume (last 8 weeks) ---
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 56);
  eightWeeksAgo.setHours(0, 0, 0, 0);

  const weekBuckets: Record<string, number> = {};
  for (let i = 0; i < 8; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 - now.getDay()) - i * 7);
    // Use Monday-based week label
    const mondayOfWeek = new Date(now);
    mondayOfWeek.setDate(now.getDate() - now.getDay() + 1 - i * 7);
    const label = mondayOfWeek.toISOString().slice(0, 10);
    weekBuckets[label] = 0;
  }

  for (const a of applications) {
    if (!a.appliedAt) continue;
    const d = new Date(a.appliedAt);
    if (d < eightWeeksAgo) continue;
    // Find the Monday of that week
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    const label = monday.toISOString().slice(0, 10);
    if (label in weekBuckets) {
      weekBuckets[label]++;
    }
  }

  const weeklyVolume = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  // --- Top Companies ---
  const companyMap: Record<string, { count: number; lastStatus: string }> = {};
  for (const a of applications) {
    const company = a.company || "Unknown";
    if (!companyMap[company]) {
      companyMap[company] = { count: 0, lastStatus: a.status || "applied" };
    }
    companyMap[company].count++;
    // The first encountered is the most recent (ordered desc)
  }

  const topCompanies = Object.entries(companyMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([company, data]) => ({
      company,
      count: data.count,
      lastStatus: data.lastStatus,
    }));

  // --- Status Breakdown ---
  const statusBreakdown = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({ status, count }));

  return NextResponse.json({
    overview: {
      totalApplications,
      thisWeek,
      thisMonth,
      responseRate,
    },
    funnel,
    weeklyVolume,
    topCompanies,
    statusBreakdown,
  });
}
