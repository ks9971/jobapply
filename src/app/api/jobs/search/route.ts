import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findJobsWithEmails, scoreJobsAgainstProfile } from "@/lib/job-search";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, location } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Get user profile for scoring
  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: true, education: true },
    }),
  ]);

  try {
    // Search for jobs with emails
    const jobs = await findJobsWithEmails(query, location);

    if (jobs.length === 0) {
      return NextResponse.json({
        jobs: [],
        totalFound: 0,
        withEmails: 0,
        message: "No jobs found. Try a different search query.",
      });
    }

    // Build profile summary for scoring
    const profileSummary = profile
      ? `Name: ${user?.name || "N/A"}
Headline: ${profile.headline || "N/A"}
Skills: ${profile.skills.map((s) => s.name).join(", ") || "None"}
Experience: ${profile.experience.map((e) => `${e.title} at ${e.company}`).join("; ") || "None"}
Education: ${profile.education.map((e) => `${e.degree} from ${e.institution}`).join("; ") || "None"}
Location: ${profile.location || "India"}`
      : "No profile set up";

    // Score jobs against profile
    const scoredJobs = await scoreJobsAgainstProfile(jobs, profileSummary);

    // Save to database
    for (const job of scoredJobs) {
      await db.savedJob.create({
        data: {
          userId,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description.substring(0, 5000),
          url: job.url,
          source: job.source,
          matchScore: job.matchScore,
          matchReason: job.matchReason,
          status: "new",
        },
      });
    }

    const withEmails = scoredJobs.filter((j) => j.hasEmail).length;

    return NextResponse.json({
      jobs: scoredJobs,
      totalFound: scoredJobs.length,
      withEmails,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: retrieve saved jobs
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await db.savedJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(jobs);
}

// DELETE: remove a saved job
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

  await db.savedJob.delete({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
