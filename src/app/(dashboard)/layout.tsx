import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { SessionProvider } from "@/components/layout/session-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const userId = session.user!.id!;

  // Check if profile is populated — gate all features behind this
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const isOnboardingPage = pathname === "/onboarding";
  const isAICoachPage = pathname === "/ai-coach";

  if (!isOnboardingPage) {
    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experience: true, education: true },
    });

    const hasProfile =
      profile &&
      profile.headline &&
      (profile.skills?.length > 0 || profile.experience?.length > 0);

    if (!hasProfile && !isAICoachPage) {
      redirect("/onboarding");
    }
  }

  return (
    <SessionProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SessionProvider>
  );
}
