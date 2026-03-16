import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface SerperJobResult {
  title: string;
  company_name?: string;
  location?: string;
  description?: string;
  link?: string;
  source?: string;
  extensions?: string[];
}

interface SerperResponse {
  jobs?: SerperJobResult[];
  organic?: { title: string; snippet: string; link: string }[];
}

export interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  emails: string[];
  hasEmail: boolean;
  salary?: string;
}

// Keep backward compat alias
export type JobWithEmail = JobResult;

// Extract email addresses from text
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Filter out common false positives
  const blacklist = ["example.com", "test.com", "email.com", "domain.com", "your", "sample"];
  return [...new Set(matches.filter((e) => {
    const lower = e.toLowerCase();
    return !blacklist.some((b) => lower.includes(b));
  }))];
}

// Search for jobs using Serper API
export async function searchJobs(query: string, location?: string): Promise<SerperResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");

  // Web search for job listings
  const searchQuery = location ? `${query} jobs ${location}` : `${query} jobs India`;

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: searchQuery,
      gl: "in", // India
      num: 30,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status}`);
  }

  return res.json();
}

// Search for jobs with Google Jobs endpoint
export async function searchGoogleJobs(query: string, location?: string): Promise<SerperResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");

  const searchQuery = location ? `${query} in ${location}` : `${query} in India`;

  const res = await fetch("https://google.serper.dev/job", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: searchQuery,
      gl: "in",
      num: 20,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper Jobs API error: ${res.status}`);
  }

  return res.json();
}

// Fetch the actual job page and extract emails from it
async function fetchPageEmails(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Strip HTML tags for cleaner email extraction
    const text = html.replace(/<[^>]*>/g, " ");
    return extractEmails(text);
  } catch {
    return [];
  }
}

// Full pipeline: search jobs, extract emails, return all jobs (email ones flagged)
export async function findJobsWithEmails(
  query: string,
  location?: string
): Promise<JobResult[]> {
  // Run both searches in parallel
  const [webResults, jobResults] = await Promise.all([
    searchJobs(query, location).catch(() => ({ organic: [] } as SerperResponse)),
    searchGoogleJobs(query, location).catch(() => ({ jobs: [] } as SerperResponse)),
  ]);

  const allJobs: { title: string; company: string; location: string; description: string; url: string; source: string }[] = [];

  // Process Google Jobs results first (higher quality)
  if (jobResults.jobs) {
    for (const job of jobResults.jobs) {
      // Google Jobs often have no link — construct a search URL as fallback
      const jobUrl = job.link || (job.title && job.company_name
        ? `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company_name} apply`)}`
        : "");
      allJobs.push({
        title: job.title || "Unknown",
        company: job.company_name || "Unknown",
        location: job.location || "",
        description: (job.description || "") + " " + (job.extensions?.join(" ") || ""),
        url: jobUrl,
        source: job.source || "google_jobs",
      });
    }
  }

  // Process web search results
  if (webResults.organic) {
    for (const result of webResults.organic) {
      allJobs.push({
        title: result.title || "Unknown",
        company: "",
        location: "",
        description: result.snippet || "",
        url: result.link || "",
        source: "web_search",
      });
    }
  }

  // Deduplicate by title+company (case-insensitive)
  const seen = new Set<string>();
  const uniqueJobs = allJobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract emails from descriptions and try fetching pages (limit concurrent fetches)
  const results: JobResult[] = [];

  // Process in batches of 5 to avoid too many concurrent requests
  for (let i = 0; i < uniqueJobs.length; i += 5) {
    const batch = uniqueJobs.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (job) => {
        let emails = extractEmails(job.description);
        // Only fetch page if no emails found and URL is a real job page (not a Google search fallback)
        if (emails.length === 0 && job.url && !job.url.startsWith("https://www.google.com/search")) {
          emails = await fetchPageEmails(job.url);
        }
        return {
          ...job,
          emails,
          hasEmail: emails.length > 0,
        };
      })
    );
    results.push(...batchResults);
  }

  // Sort: email-apply jobs first, then the rest
  results.sort((a, b) => {
    if (a.hasEmail && !b.hasEmail) return -1;
    if (!a.hasEmail && b.hasEmail) return 1;
    return 0;
  });

  return results;
}

// AI scores jobs against user profile
export async function scoreJobsAgainstProfile(
  jobs: JobResult[],
  profileSummary: string
): Promise<(JobResult & { matchScore: number; matchReason: string })[]> {
  if (jobs.length === 0) return [];

  const openai = getOpenAI();

  const jobList = jobs.map((j, i) => `[${i}] ${j.title} at ${j.company} - ${j.description.substring(0, 200)}`).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Score how well each job matches the candidate's profile. Return a JSON array:
[{"index": 0, "score": 85, "reason": "Strong match because..."}]
Score 0-100. Be honest. Consider skills, experience level, location, and role fit.
Only return valid JSON.`,
      },
      {
        role: "user",
        content: `Candidate Profile:\n${profileSummary}\n\nJobs:\n${jobList}`,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content!);
  const scores: { index: number; score: number; reason: string }[] = Array.isArray(parsed) ? parsed : parsed.scores || parsed.results || [];

  return jobs.map((job, i) => {
    const scoreData = scores.find((s) => s.index === i);
    return {
      ...job,
      matchScore: scoreData?.score || 0,
      matchReason: scoreData?.reason || "No analysis available",
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
