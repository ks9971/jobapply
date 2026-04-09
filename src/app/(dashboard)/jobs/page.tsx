"use client";

import { useState, useEffect } from "react";

interface Job {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  emails: string[];
  hasEmail: boolean;
  matchScore: number;
  matchReason: string;
}

interface SavedJob {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  matchScore?: number;
  matchReason?: string;
  status: string;
  createdAt: string;
}

interface ATSResult {
  score: number;
  summary: string;
  keywords_found: string[];
  keywords_missing: string[];
  section_scores: {
    keyword_match: number;
    formatting: number;
    experience_relevance: number;
    skills_match: number;
    achievements: number;
  };
  suggestions: { priority: string; text: string }[];
  formatting_issues: string[];
}

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [atsModal, setAtsModal] = useState<{ job: Job; index: number } | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  async function fetchSavedJobs() {
    const res = await fetch("/api/jobs/search");
    if (res.ok) setSavedJobs(await res.json());
  }

  async function searchJobs(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setResults([]);
    setMessage(null);

    const res = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, location }),
    });

    if (res.ok) {
      const data = await res.json();
      setResults(data.jobs || []);
      if (data.jobs?.length === 0) {
        setMessage({ type: "error", text: "No jobs found. Try a broader search." });
      } else {
        const emailCount = data.withEmails || 0;
        setMessage({ type: "success", text: `Found ${data.jobs.length} jobs (${emailCount} with direct email apply)!` });
      }
      fetchSavedJobs();
    } else {
      const err = await res.json();
      setMessage({ type: "error", text: err.error || "Search failed" });
    }

    setSearching(false);
  }

  async function applyToJob(job: Job, email: string) {
    setApplying(email);
    setMessage(null);

    const res = await fetch("/api/jobs/auto-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        jobId: null, // from search results, not saved yet with separate ID
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessage({ type: "success", text: `Application sent to ${data.sentTo}! Tracking started.` });
      fetchSavedJobs();
    } else {
      const err = await res.json();
      setMessage({ type: "error", text: err.error || "Failed to apply" });
    }

    setApplying(null);
  }

  async function checkATSScore(job: Job, index: number) {
    setAtsModal({ job, index });
    setAtsLoading(true);
    setAtsResult(null);

    try {
      const res = await fetch("/api/ai/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: job.description,
          jobTitle: job.title,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAtsResult(data);
      } else {
        setMessage({ type: "error", text: "Failed to check ATS score. Make sure your profile has a CV uploaded." });
        setAtsModal(null);
      }
    } catch {
      setMessage({ type: "error", text: "ATS scoring failed" });
      setAtsModal(null);
    }

    setAtsLoading(false);
  }

  function getATSScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  }

  function getATSBarColor(score: number) {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-700 bg-green-100";
    if (score >= 60) return "text-yellow-700 bg-yellow-100";
    if (score >= 40) return "text-orange-700 bg-orange-100";
    return "text-red-700 bg-red-100";
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Search</h1>
          <p className="text-gray-500">Find jobs and apply instantly via Gmail when email contacts are available</p>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={searchJobs} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role / Skills</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. React Developer, Data Scientist"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bangalore, Mumbai, Remote"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={searching}
              className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
            >
              {searching ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching & Scoring...
                </span>
              ) : (
                "Search Jobs"
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          AI scores each job against your profile. Jobs with email contacts are highlighted for one-click apply.
        </p>
      </form>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
          message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results ({results.length} jobs)
          </h2>
          {results.map((job, i) => (
            <div key={i} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${job.hasEmail ? "border-green-200" : "border-gray-200"}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getScoreColor(job.matchScore)}`}>
                        {job.matchScore}% match
                      </span>
                      {job.hasEmail && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Email Apply
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{job.company} {job.location && `· ${job.location}`}</p>
                    <p className="text-xs text-gray-400 mt-1">{job.matchReason}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {job.hasEmail ? (
                      job.emails.map((email) => (
                        <button
                          key={email}
                          onClick={() => applyToJob(job, email)}
                          disabled={applying === email}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap transition-colors"
                        >
                          {applying === email ? "Sending..." : `Apply → ${email}`}
                        </button>
                      ))
                    ) : (
                      job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap transition-colors text-center"
                        >
                          View Listing
                        </a>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => setExpandedJob(expandedJob === i ? null : i)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {expandedJob === i ? "Hide description" : "Show description"}
                  </button>
                  {job.description && (
                    <button
                      onClick={() => checkATSScore(job, i)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Check ATS Score
                    </button>
                  )}
                </div>

                {expandedJob === i && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 max-h-60 overflow-y-auto">
                    {job.description || "No description available"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Previously Saved Jobs */}
      {savedJobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Previous Searches</h2>
          {savedJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{job.title}</p>
                  {job.matchScore && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(job.matchScore)}`}>
                      {job.matchScore}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{job.company} {job.location && `· ${job.location}`}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                job.status === "applied" ? "bg-green-100 text-green-700" :
                job.status === "interested" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {job.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && savedJobs.length === 0 && !searching && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Search for Jobs</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a job role and location above. We&apos;ll find matching jobs, score them against
            your profile, and highlight ones with email contacts for instant apply.
          </p>
        </div>
      )}

      {/* ATS Score Modal */}
      {atsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">ATS Compatibility Score</h3>
                <p className="text-sm text-gray-500">{atsModal.job.title} at {atsModal.job.company}</p>
              </div>
              <button onClick={() => { setAtsModal(null); setAtsResult(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {atsLoading ? (
                <div className="text-center py-12">
                  <svg className="animate-spin w-10 h-10 text-purple-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-gray-600 font-medium">Analyzing your resume against this JD...</p>
                  <p className="text-xs text-gray-400 mt-1">Checking keywords, formatting, and ATS compatibility</p>
                </div>
              ) : atsResult ? (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className="text-center">
                    <div className={`text-5xl font-bold ${getATSScoreColor(atsResult.score)}`}>
                      {atsResult.score}%
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{atsResult.summary}</p>
                  </div>

                  {/* Section Scores */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm">Score Breakdown</h4>
                    {Object.entries(atsResult.section_scores).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600 capitalize">{key.replace(/_/g, " ")}</span>
                          <span className={`font-bold ${getATSScoreColor(value)}`}>{value}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${getATSBarColor(value)}`} style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Keywords */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-green-700 text-sm mb-2">Keywords Found</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.keywords_found.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs border border-green-200">{kw}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-700 text-sm mb-2">Keywords Missing</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {atsResult.keywords_missing.map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs border border-red-200">{kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-2">Suggestions to Improve</h4>
                    <div className="space-y-2">
                      {atsResult.suggestions.map((s, i) => (
                        <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                          s.priority === "high" ? "bg-red-50 border border-red-100" :
                          s.priority === "medium" ? "bg-yellow-50 border border-yellow-100" :
                          "bg-blue-50 border border-blue-100"
                        }`}>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${
                            s.priority === "high" ? "bg-red-200 text-red-800" :
                            s.priority === "medium" ? "bg-yellow-200 text-yellow-800" :
                            "bg-blue-200 text-blue-800"
                          }`}>{s.priority}</span>
                          <span className="text-gray-700">{s.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formatting Issues */}
                  {atsResult.formatting_issues.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-2">Formatting Issues</h4>
                      <ul className="space-y-1">
                        {atsResult.formatting_issues.map((issue, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-orange-500 mt-0.5">!</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
