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

export interface JobWithEmail {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  emails: string[];
  salary?: string;
}

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

  // Use Google Jobs search
  const searchQuery = location ? `${query} jobs ${location} email apply` : `${query} jobs India email apply`;

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

// Full pipeline: search jobs, extract emails, filter to only email-apply jobs
export async function findJobsWithEmails(
  query: string,
  location?: string
): Promise<JobWithEmail[]> {
  // Run both searches in parallel
  const [webResults, jobResults] = await Promise.all([
    searchJobs(query, location).catch(() => ({ organic: [] } as SerperResponse)),
    searchGoogleJobs(query, location).catch(() => ({ jobs: [] } as SerperResponse)),
  ]);

  const allJobs: { title: string; company: string; location: string; description: string; url: string; source: string }[] = [];

  // Process Google Jobs results
  if (jobResults.jobs) {
    for (const job of jobResults.jobs) {
      allJobs.push({
        title: job.title || "Unknown",
        company: job.company_name || "Unknown",
        location: job.location || "",
        description: (job.description || "") + " " + (job.extensions?.join(" ") || ""),
        url: job.link || "",
        source: job.source || "google_jobs",
      });
    }
  }

  // Process web search results (often have email-apply jobs)
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

  // Extract emails from descriptions and fetch pages for more
  const jobsWithEmails: JobWithEmail[] = [];

  for (const job of allJobs) {
    // First check description for emails
    let emails = extractEmails(job.description);

    // If no email in description, try fetching the page
    if (emails.length === 0 && job.url) {
      emails = await fetchPageEmails(job.url);
    }

    // Only keep jobs that have emails
    if (emails.length > 0) {
      jobsWithEmails.push({
        ...job,
        emails,
      });
    }
  }

  return jobsWithEmails;
}

// AI scores jobs against user profile
export async function scoreJobsAgainstProfile(
  jobs: JobWithEmail[],
  profileSummary: string
): Promise<(JobWithEmail & { matchScore: number; matchReason: string })[]> {
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
