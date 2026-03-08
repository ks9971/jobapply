import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Nav */}
      <nav className="flex items-center justify-between p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-600">JobApply</h1>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
            Sign in
          </Link>
          <Link href="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 leading-tight">
            Automate Your Job Applications with AI
          </h2>
          <p className="mt-6 text-xl text-gray-600">
            Upload your CV, build tailored resumes with AI, and automatically apply to jobs on Naukri, LinkedIn, and more. Track all your applications in one place.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link href="/register" className="px-8 py-3 bg-blue-600 text-white rounded-lg text-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-200">
              Start Free
            </Link>
            <Link href="/login" className="px-8 py-3 bg-white text-gray-700 rounded-lg text-lg font-medium hover:bg-gray-50 border border-gray-300">
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "AI CV Builder",
              description: "Upload your existing CV or build a new one from scratch. Our AI tailors it for each job description.",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            },
            {
              title: "Auto Apply",
              description: "Connect your Naukri and LinkedIn accounts. We auto-fill forms and apply to matched jobs while you sleep.",
              icon: "M13 10V3L4 14h7v7l9-11h-7z",
            },
            {
              title: "Application Tracker",
              description: "Track every application status in one dashboard. Get insights on your response rates and interview pipeline.",
              icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
