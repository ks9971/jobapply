import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import RemindersCard from "@/components/RemindersCard";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, applicationCount, cvCount, profile, gmailToken] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.application.count({ where: { userId } }),
    db.cVDocument.count({ where: { userId } }),
    db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: true, education: true },
    }),
    db.gmailToken.findUnique({ where: { userId } }),
  ]);

  const [recentApplications, recentEmails, statusCounts] = await Promise.all([
    db.application.findMany({
      where: { userId },
      orderBy: { appliedAt: "desc" },
      take: 5,
    }),
    db.emailTracking.findMany({
      where: { userId },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }),
    Promise.all([
      db.application.count({ where: { userId, status: "applied" } }),
      db.application.count({ where: { userId, status: "interview" } }),
      db.application.count({ where: { userId, status: "offered" } }),
      db.application.count({ where: { userId, status: "rejected" } }),
    ]),
  ]);

  const [appliedCount, interviewCount, offeredCount, rejectedCount] = statusCounts;

  // Calculate profile completeness
  const profileFields = [
    profile?.phone,
    profile?.location,
    profile?.headline,
    profile?.summary,
    (profile?.skills?.length ?? 0) > 0 ? "yes" : null,
    (profile?.experience?.length ?? 0) > 0 ? "yes" : null,
    (profile?.education?.length ?? 0) > 0 ? "yes" : null,
  ];
  const filledFields = profileFields.filter(Boolean).length;
  const profileCompleteness = Math.round((filledFields / profileFields.length) * 100);

  const statusColorMap: Record<string, string> = {
    applied: "bg-blue-100 text-blue-800",
    in_review: "bg-yellow-100 text-yellow-800",
    interview: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    offered: "bg-purple-100 text-purple-800",
  };

  const emailCategoryMap: Record<string, { label: string; color: string }> = {
    interview_invite: { label: "Interview", color: "bg-green-100 text-green-800" },
    rejection: { label: "Rejection", color: "bg-red-100 text-red-800" },
    offer: { label: "Offer", color: "bg-purple-100 text-purple-800" },
    application_received: { label: "Received", color: "bg-blue-100 text-blue-800" },
    follow_up: { label: "Follow Up", color: "bg-yellow-100 text-yellow-800" },
    other: { label: "Other", color: "bg-gray-100 text-gray-800" },
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name || session!.user!.name || "User"}
          </h1>
          <p className="text-gray-500">Your job application command center</p>
        </div>
        <Link
          href="/ai-coach"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 text-sm font-medium shadow-md transition-all"
        >
          Open AI Coach
        </Link>
      </div>

      {/* Profile Completeness Alert */}
      {profileCompleteness < 100 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-amber-800">Profile {profileCompleteness}% complete</p>
              <p className="text-sm text-amber-600">Upload your CV to auto-fill everything, or chat with AI Coach</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/onboarding" className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200">
              Upload CV
            </Link>
            <Link href="/ai-coach" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
              AI Coach
            </Link>
          </div>
        </div>
      )}

      {/* Reminders */}
      <RemindersCard />

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Applied", value: applicationCount, color: "from-blue-500 to-blue-600" },
          { label: "In Progress", value: appliedCount, color: "from-cyan-500 to-cyan-600" },
          { label: "Interviews", value: interviewCount, color: "from-green-500 to-green-600" },
          { label: "Offers", value: offeredCount, color: "from-purple-500 to-purple-600" },
          { label: "CVs Created", value: cvCount, color: "from-orange-500 to-orange-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Applications</h2>
            <Link href="/applications" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {recentApplications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 mb-3">No applications yet</p>
              <Link href="/ai-coach" className="text-sm text-blue-600 hover:underline">
                Chat with AI to get started
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentApplications.map((app: { id: string; jobTitle: string; company: string; status: string; appliedAt: Date }) => (
                <div key={app.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{app.jobTitle}</p>
                    <p className="text-xs text-gray-500">{app.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColorMap[app.status] || "bg-gray-100 text-gray-800"}`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {app.appliedAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gmail Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Email Activity</h2>
            {gmailToken ? (
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                Gmail Connected
              </span>
            ) : (
              <Link href="/settings" className="text-xs text-blue-600 hover:text-blue-700">
                Connect Gmail
              </Link>
            )}
          </div>
          {!gmailToken ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm mb-3">Connect Gmail to auto-track responses</p>
              <Link href="/settings" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 inline-block">
                Connect Gmail
              </Link>
            </div>
          ) : recentEmails.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No job-related emails detected yet. We&apos;ll scan automatically.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentEmails.map((email) => {
                const cat = emailCategoryMap[email.category] || emailCategoryMap.other;
                return (
                  <div key={email.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 text-sm truncate max-w-[70%]">{email.subject}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{email.fromEmail}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/ai-coach"
          className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3">AI</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">AI Career Coach</h3>
          <p className="text-sm text-gray-500 mt-1">Chat about careers, analyze jobs, generate CVs</p>
        </Link>
        <Link
          href="/onboarding"
          className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-green-700">Upload CV</h3>
          <p className="text-sm text-gray-500 mt-1">Upload your CV to auto-fill your entire profile</p>
        </Link>
        <Link
          href="/applications"
          className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center text-white mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700">Applications</h3>
          <p className="text-sm text-gray-500 mt-1">Track all your applications and responses</p>
        </Link>
      </div>

      {/* Success Rate */}
      {applicationCount > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Application Pipeline</h3>
          <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-gray-100">
            {appliedCount > 0 && (
              <div className="bg-blue-500 transition-all" style={{ width: `${(appliedCount / applicationCount) * 100}%` }} title={`Applied: ${appliedCount}`} />
            )}
            {interviewCount > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${(interviewCount / applicationCount) * 100}%` }} title={`Interview: ${interviewCount}`} />
            )}
            {offeredCount > 0 && (
              <div className="bg-purple-500 transition-all" style={{ width: `${(offeredCount / applicationCount) * 100}%` }} title={`Offered: ${offeredCount}`} />
            )}
            {rejectedCount > 0 && (
              <div className="bg-red-400 transition-all" style={{ width: `${(rejectedCount / applicationCount) * 100}%` }} title={`Rejected: ${rejectedCount}`} />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" />Applied: {appliedCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" />Interview: {interviewCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded-full" />Offered: {offeredCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" />Rejected: {rejectedCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
