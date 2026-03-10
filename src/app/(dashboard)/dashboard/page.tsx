import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [applicationCount, cvCount, profile] = await Promise.all([
    db.application.count({ where: { userId } }),
    db.cVDocument.count({ where: { userId } }),
    db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: true },
    }),
  ]);

  const recentApplications = await db.application.findMany({
    where: { userId },
    orderBy: { appliedAt: "desc" },
    take: 5,
  });

  const stats = [
    { label: "Total Applications", value: applicationCount, color: "bg-blue-500" },
    { label: "CVs Created", value: cvCount, color: "bg-green-500" },
    { label: "Skills Listed", value: profile?.skills.length ?? 0, color: "bg-purple-500" },
    { label: "Experience Entries", value: profile?.experience.length ?? 0, color: "bg-orange-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back, {session!.user!.name || "User"}
      </h1>
      <p className="text-gray-500 mb-8">Here&apos;s your job application overview</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <span className="text-white text-xl font-bold">{stat.value}</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
        </div>
        {recentApplications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No applications yet. Start applying to jobs!
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentApplications.map((app: { id: string; jobTitle: string; company: string; portal: string; status: string; appliedAt: Date }) => (
              <div key={app.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{app.jobTitle}</p>
                  <p className="text-sm text-gray-500">{app.company} &middot; {app.portal}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    app.status === "applied" ? "bg-blue-100 text-blue-800" :
                    app.status === "interview" ? "bg-green-100 text-green-800" :
                    app.status === "rejected" ? "bg-red-100 text-red-800" :
                    app.status === "offered" ? "bg-purple-100 text-purple-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
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
    </div>
  );
}
