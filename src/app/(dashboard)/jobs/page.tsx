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

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

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
        setMessage({ type: "error", text: "No jobs with email contacts found. Try a broader search." });
      } else {
        setMessage({ type: "success", text: `Found ${data.jobs.length} jobs with email contacts!` });
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
          <p className="text-gray-500">Find jobs with email contacts — apply instantly via Gmail</p>
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
          Only shows jobs that include an email address for direct application. AI scores each job against your profile.
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
            Search Results ({results.length} jobs with email)
          </h2>
          {results.map((job, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getScoreColor(job.matchScore)}`}>
                        {job.matchScore}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{job.company} {job.location && `· ${job.location}`}</p>
                    <p className="text-xs text-gray-400 mt-1">{job.matchReason}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {job.emails.map((email) => (
                      <button
                        key={email}
                        onClick={() => applyToJob(job, email)}
                        disabled={applying === email}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap transition-colors"
                      >
                        {applying === email ? "Sending..." : `Apply → ${email}`}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedJob(expandedJob === i ? null : i)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                >
                  {expandedJob === i ? "Hide description" : "Show description"}
                </button>

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
            Enter a job role and location above. We&apos;ll find jobs that accept email applications
            and score them against your profile.
          </p>
        </div>
      )}
    </div>
  );
}
