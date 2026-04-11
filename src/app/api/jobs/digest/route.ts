import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findJobsWithEmails, scoreJobsAgainstProfile } from "@/lib/job-search";
import { sendEmail } from "@/lib/gmail";

// Vercel Cron handler — runs daily at 4 AM UTC (9:30 AM IST)
export async function POST(req: NextRequest) {
  // Verify this is a cron request (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all users with digest enabled who have Gmail connected and job preferences
  const users = await db.user.findMany({
    where: {
      digestEnabled: true,
      gmailToken: { isNot: null },
    },
    include: {
      profile: {
        include: {
          jobPreference: true,
          skills: true,
          experience: { orderBy: { startDate: "desc" }, take: 3 },
        },
      },
      gmailToken: true,
    },
  });

  const results: { userId: string; status: string; jobCount?: number }[] = [];

  for (const user of users) {
    try {
      if (!user.profile?.jobPreference) {
        results.push({ userId: user.id, status: "skipped: no job preferences" });
        continue;
      }

      // Skip if already sent today
      if (user.lastDigestAt) {
        const lastSent = new Date(user.lastDigestAt);
        const now = new Date();
        if (lastSent.toDateString() === now.toDateString()) {
          results.push({ userId: user.id, status: "skipped: already sent today" });
          continue;
        }
      }

      // Parse roles from job preferences
      let roles: string[] = [];
      try {
        roles = JSON.parse(user.profile.jobPreference.roles);
      } catch {
        roles = [user.profile.jobPreference.roles];
      }

      if (roles.length === 0) {
        results.push({ userId: user.id, status: "skipped: no preferred roles" });
        continue;
      }

      // Parse locations
      let locations: string[] = [];
      try {
        locations = JSON.parse(user.profile.jobPreference.locations);
      } catch {
        locations = [user.profile.jobPreference.locations];
      }

      // Search for jobs matching first role + first location
      const query = roles[0] || "software developer";
      const location = locations[0] || undefined;
      const jobs = await findJobsWithEmails(query, location);

      if (jobs.length === 0) {
        results.push({ userId: user.id, status: "no jobs found" });
        continue;
      }

      // Score against profile
      const profileSummary = [
        user.profile.headline || "",
        `Skills: ${user.profile.skills.map((s) => s.name).join(", ")}`,
        `Experience: ${user.profile.experience.map((e) => `${e.title} at ${e.company}`).join(", ")}`,
      ].join(" | ");

      const scoredJobs = await scoreJobsAgainstProfile(jobs.slice(0, 10), profileSummary);
      const topJobs = scoredJobs.slice(0, 5);

      // Build email HTML
      const jobRows = topJobs
        .map(
          (job, i) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px;">
            <strong>${i + 1}. ${job.title}</strong> at ${job.company}${job.location ? ` (${job.location})` : ""}
            <br><span style="color: #666; font-size: 13px;">${job.matchReason}</span>
            ${job.hasEmail ? `<br><span style="color: #2563eb;">📧 ${job.emails.join(", ")}</span>` : ""}
          </td>
          <td style="padding: 12px; text-align: center;">
            <strong style="color: ${job.matchScore >= 70 ? "#16a34a" : job.matchScore >= 50 ? "#d97706" : "#dc2626"};">${job.matchScore}%</strong>
          </td>
          <td style="padding: 12px;">
            <a href="https://www.naukri.com/jobid?q=${encodeURIComponent(`${job.title} ${job.company}`)}" style="color: #2563eb; text-decoration: none;">Naukri</a> |
            <a href="https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${job.title} ${job.company}`)}&location=India" style="color: #2563eb; text-decoration: none;">LinkedIn</a>
            ${job.url && !job.url.includes("naukri.com/jobid") ? `| <a href="${job.url}" style="color: #2563eb; text-decoration: none;">Original</a>` : ""}
          </td>
        </tr>`
        )
        .join("");

      const emailBody = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">🎯 Your Daily Job Digest</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">Top ${topJobs.length} matches for "${query}"${location ? ` in ${location}` : ""}</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; background: white;">
    <thead>
      <tr style="background: #f9fafb;">
        <th style="padding: 10px; text-align: left; font-size: 13px; color: #666;">Job</th>
        <th style="padding: 10px; text-align: center; font-size: 13px; color: #666;">Match</th>
        <th style="padding: 10px; text-align: left; font-size: 13px; color: #666;">Apply</th>
      </tr>
    </thead>
    <tbody>${jobRows}</tbody>
  </table>
  <div style="padding: 16px; background: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
    <a href="${process.env.NEXTAUTH_URL || "https://jobapply-pi.vercel.app"}/jobs" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View All Jobs →</a>
    <p style="color: #999; font-size: 12px; margin: 12px 0 0;">Sent by <a href="${process.env.NEXTAUTH_URL || "https://jobapply-pi.vercel.app"}" style="color: #2563eb; text-decoration: none;">JobApply</a> • <a href="${process.env.NEXTAUTH_URL || "https://jobapply-pi.vercel.app"}/settings" style="color: #999; text-decoration: none;">Unsubscribe</a></p>
  </div>
</body>
</html>`;

      // Send via user's connected Gmail
      await sendEmail(
        user.id,
        user.email,
        `🎯 ${topJobs.length} new job matches — ${query}${location ? ` in ${location}` : ""}`,
        emailBody
      );

      // Save top jobs to SavedJob for reference
      for (const job of topJobs) {
        await db.savedJob.create({
          data: {
            userId: user.id,
            title: job.title,
            company: job.company,
            location: job.location || "",
            description: job.description?.substring(0, 500) || "",
            url: job.url || "",
            source: "daily_digest",
            hasEmail: job.hasEmail,
            emails: job.emails || [],
            matchScore: job.matchScore,
            matchReason: job.matchReason,
            searchQuery: query,
          },
        }).catch(() => null);
      }

      // Update last digest time
      await db.user.update({
        where: { id: user.id },
        data: { lastDigestAt: new Date() },
      });

      results.push({ userId: user.id, status: "sent", jobCount: topJobs.length });
    } catch (error) {
      results.push({
        userId: user.id,
        status: `error: ${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  }

  return NextResponse.json({
    processed: users.length,
    results,
  });
}
