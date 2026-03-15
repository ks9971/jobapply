"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Markdown from "react-markdown";
import { TEMPLATES, type TemplateStyle, type CVData } from "@/lib/cv-templates";

const PDFDownloadButton = dynamic(
  () => import("../cv-builder/pdf-download").then((mod) => ({ default: mod.PDFDownloadButton })),
  { ssr: false, loading: () => <span className="text-xs text-gray-400">Loading PDF...</span> }
);

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const SUGGESTIONS = [
  { text: "Build me a resume for a Software Engineer role", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { text: "Review my profile and suggest improvements", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { text: "What roles am I best suited for?", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { text: "Write a cover letter for a React developer position", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
];

function detectCVContent(text: string): boolean {
  const markers = ["# ", "## Professional Summary", "## Work Experience", "## Education", "## Skills", "## Contact"];
  let count = 0;
  for (const m of markers) {
    if (text.includes(m)) count++;
  }
  return count >= 3;
}

/** Parse AI-generated markdown CV into structured CVData for PDF rendering */
function parseMarkdownToCV(markdown: string, fallback: CVData | null): CVData {
  const data: CVData = {
    name: "",
    email: "",
    phone: "",
    location: "",
    headline: "",
    summary: "",
    education: [],
    experience: [],
    skills: [],
  };

  const lines = markdown.split("\n");
  let currentSection = "";

  // Extract name from first H1
  for (const line of lines) {
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      data.name = line.replace("# ", "").trim();
      break;
    }
  }

  // Extract contact info - look for email, phone, location patterns near the top
  const contactBlock = lines.slice(0, 15).join("\n");
  const emailMatch = contactBlock.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) data.email = emailMatch[0];
  const phoneMatch = contactBlock.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (phoneMatch) data.phone = phoneMatch[0].trim();
  const locationPatterns = contactBlock.match(/(?:Location|Address|City|Based in)[:\s]*([^\n|*]+)/i);
  if (locationPatterns) data.location = locationPatterns[1].trim();

  // Parse sections
  let sectionContent: string[] = [];

  function processSection() {
    const content = sectionContent.join("\n").trim();
    if (!content) return;

    const sectionLower = currentSection.toLowerCase();

    if (sectionLower.includes("summary") || sectionLower.includes("objective") || sectionLower.includes("about")) {
      data.summary = content.replace(/^[-*•]\s*/gm, "").trim();
    } else if (sectionLower.includes("experience") || sectionLower.includes("employment") || sectionLower.includes("work history")) {
      parseExperience(content);
    } else if (sectionLower.includes("education") || sectionLower.includes("academic")) {
      parseEducation(content);
    } else if (sectionLower.includes("skill") || sectionLower.includes("competenc") || sectionLower.includes("technologies")) {
      parseSkills(content);
    }
  }

  function parseExperience(content: string) {
    const entries = content.split(/(?=###\s|(?:^|\n)\*\*[^*]+\*\*\s*(?:\||—|–))/);
    for (const entry of entries) {
      if (!entry.trim()) continue;
      const entryLines = entry.trim().split("\n").filter((l) => l.trim());
      if (entryLines.length === 0) continue;

      const titleLine = entryLines[0].replace(/^###\s*/, "").replace(/\*\*/g, "").trim();
      // Split on " | ", " — ", " – ", " at ", " @ " — but use word boundaries for "at" to avoid splitting "Data Scientist"
      const titleParts = titleLine.split(/\s*(?:\||—|–)\s*|\s+(?:at|@)\s+/);
      const title = titleParts[0]?.trim() || titleLine;
      const company = titleParts[1]?.trim() || "";

      let startDate = "";
      let endDate = "";
      let current = false;
      let location = "";
      let resolvedCompany = company;
      const descLines: string[] = [];

      for (let i = 1; i < entryLines.length; i++) {
        const line = entryLines[i].replace(/\*\*/g, "").replace(/\*/g, "").trim();
        const dateMatch = line.match(/(\w+\.?\s*\d{4})\s*(?:[-–—]|to)\s*(\w+\.?\s*\d{4}|Present|Current|Now)/i);
        if (dateMatch) {
          startDate = dateMatch[1];
          const end = dateMatch[2];
          if (/present|current|now/i.test(end)) {
            current = true;
          } else {
            endDate = end;
          }
          const afterDate = line.replace(dateMatch[0], "").replace(/[|,]/g, "").trim();
          if (afterDate && !location) location = afterDate;
        } else if (line.startsWith("-") || line.startsWith("•")) {
          descLines.push(line.replace(/^[-•]\s*/, ""));
        } else if (!resolvedCompany && i <= 2 && !line.startsWith("-") && !line.startsWith("•") && line.length < 60) {
          // Company name is often on the line right after the title
          resolvedCompany = line;
        }
      }

      if (title) {
        data.experience.push({
          title,
          company: resolvedCompany,
          location,
          startDate,
          endDate,
          current,
          description: descLines.join("\n"),
        });
      }
    }
  }

  function parseEducation(content: string) {
    const entries = content.split(/(?=###\s|(?:^|\n)\*\*[^*]+\*\*)/);
    for (const entry of entries) {
      if (!entry.trim()) continue;
      const entryLines = entry.trim().split("\n").filter((l) => l.trim());
      if (entryLines.length === 0) continue;

      const titleLine = entryLines[0].replace(/^###\s*/, "").replace(/\*\*/g, "").trim();
      const parts = titleLine.split(/\s*(?:\||—|–|-|,)\s*/);

      let degree = parts[0]?.trim() || titleLine;
      let field = "";
      let institution = parts[1]?.trim() || "";

      const inMatch = degree.match(/^(.+?)\s+in\s+(.+)$/i);
      if (inMatch) {
        degree = inMatch[1].trim();
        field = inMatch[2].trim();
      }

      let startYear = 0;
      let endYear = 0;
      let grade = "";

      for (let i = 1; i < entryLines.length; i++) {
        const line = entryLines[i].replace(/\*\*/g, "").replace(/\*/g, "").trim();
        const yearMatch = line.match(/(\d{4})\s*(?:[-–—]|to)\s*(\d{4}|Present|Current)/i);
        if (yearMatch) {
          startYear = parseInt(yearMatch[1]);
          if (!/present|current/i.test(yearMatch[2])) endYear = parseInt(yearMatch[2]);
        }
        const gradeMatch = line.match(/(?:GPA|CGPA|Grade|Score)[:\s]*([^\n,|]+)/i);
        if (gradeMatch) grade = gradeMatch[1].trim();
        if (!institution) {
          const instLine = line.replace(/^[-•*]\s*/, "").trim();
          if (instLine && !yearMatch && !gradeMatch && !/^[-•*]/.test(line)) {
            institution = instLine;
          }
        }
      }

      if (degree || institution) {
        data.education.push({
          institution: institution || "Unknown",
          degree,
          field,
          startYear,
          endYear,
          grade,
        });
      }
    }
  }

  function parseSkills(content: string) {
    const skillLines = content.split("\n");
    for (const line of skillLines) {
      const cleaned = line.replace(/^[-•*]\s*/, "").replace(/\*\*/g, "").trim();
      if (!cleaned) continue;
      const categoryMatch = cleaned.match(/^([^:]+):\s*(.+)/);
      if (categoryMatch) {
        const skills = categoryMatch[2].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        for (const skill of skills) {
          data.skills.push({ name: skill, level: "intermediate" });
        }
      } else {
        const skills = cleaned.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        for (const skill of skills) {
          if (skill.length < 50) {
            data.skills.push({ name: skill, level: "intermediate" });
          }
        }
      }
    }
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      processSection();
      currentSection = line.replace("## ", "").trim();
      sectionContent = [];
    } else if (currentSection) {
      sectionContent.push(line);
    }
  }
  processSection();

  // Fallback: use profile data for any empty fields
  if (fallback) {
    if (!data.name) data.name = fallback.name;
    if (!data.email) data.email = fallback.email;
    if (!data.phone) data.phone = fallback.phone;
    if (!data.location) data.location = fallback.location;
    if (!data.headline) data.headline = fallback.headline;
    if (!data.summary) data.summary = fallback.summary;
    if (data.education.length === 0) data.education = fallback.education;
    if (data.experience.length === 0) data.experience = fallback.experience;
    if (data.skills.length === 0) data.skills = fallback.skills;
  }

  return data;
}

export default function AICoachPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [profileData, setProfileData] = useState<CVData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>("professional");
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchProfile();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function fetchHistory() {
    const res = await fetch("/api/ai/chat");
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
    setHistoryLoaded(true);
  }

  async function fetchProfile() {
    const [profileRes, sessionRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/auth/session"),
    ]);
    if (profileRes.ok) {
      const profile = await profileRes.json();
      const session = sessionRes.ok ? await sessionRes.json() : {};
      setProfileData({
        name: session?.user?.name || "",
        email: session?.user?.email || "",
        phone: profile?.phone || "",
        location: profile?.location || "",
        headline: profile?.headline || "",
        summary: profile?.summary || "",
        education: profile?.education || [],
        experience: profile?.experience || [],
        skills: profile?.skills?.map((s: { name: string; level: string }) => ({
          name: s.name,
          level: s.level || "intermediate",
        })) || [],
      });
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }

    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx")) {
      alert("Please upload a PDF or DOCX file.");
      return;
    }

    setUploading(true);

    const userMsg: ChatMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: `Attached resume: **${file.name}**\n\nPlease review this resume and suggest improvements. Also, use this to update my profile.`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/cv/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }
      const uploadData = await uploadRes.json();

      const parseRes = await fetch("/api/cv/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: uploadData.id }),
      });

      let resumeText = "";
      if (parseRes.ok) {
        const parseData = await parseRes.json();
        resumeText = JSON.stringify(parseData.parsedData, null, 2);
        fetchProfile();
      }

      const chatMessage = resumeText
        ? `I've uploaded my resume (${file.name}). Here's the extracted data:\n\n${resumeText}\n\nPlease review this resume thoroughly. Tell me what's strong, what needs improvement, and suggest specific changes to make it more impactful and ATS-friendly.`
        : `I've uploaded my resume (${file.name}) but couldn't parse its contents. Can you help me review and improve my resume?`;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMsg = {
          id: `resp-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (detectCVContent(data.message)) {
          setShowTemplateSelector(assistantMsg.id);
        }
      } else {
        throw new Error("Failed to get AI response");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error processing your resume: ${errMsg}. Please try again.`,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendMessage(content?: string) {
    const text = content || input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMsg = {
          id: `resp-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (detectCVContent(data.message)) {
          setShowTemplateSelector(assistantMsg.id);
        }
      } else {
        const err = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `Something went wrong: ${err.error || "Unknown error"}. Please try again.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  }

  async function clearChat() {
    if (!confirm("Clear all chat history?")) return;
    await fetch("/api/ai/chat", { method: "DELETE" });
    setMessages([]);
    setShowTemplateSelector(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    setInput(el.value);
  }

  function getCVDataForMessage(msgContent: string): CVData | null {
    if (!detectCVContent(msgContent)) return null;
    return parseMarkdownToCV(msgContent, profileData);
  }

  if (!historyLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-3 animate-pulse">AI</div>
          <p className="text-gray-400 text-sm">Loading your AI coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md">AI</div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Career Coach</h1>
            <p className="text-[11px] text-gray-400">Build resumes, analyze jobs, get career advice</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mb-5 shadow-xl">
              AI
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              What can I help you with?
            </h2>
            <p className="text-gray-400 max-w-md mb-8 text-sm">
              I can build your resume, write cover letters, analyze job matches, and give personalized career advice. Upload your resume or just ask.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-start gap-3 text-left px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:shadow-sm transition-all group"
                >
                  <svg className="w-5 h-5 mt-0.5 text-gray-400 group-hover:text-blue-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                  </svg>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>

            {/* Upload CTA */}
            <div className="mt-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload your resume (PDF) to get started
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1 flex-shrink-0">AI</div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-md shadow-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-strong:text-gray-800 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>

            {/* PDF Download bar — uses parsed markdown data */}
            {msg.role === "assistant" && detectCVContent(msg.content) && (
              <div className="ml-9 mt-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-800">
                    Your resume is ready! Choose a design and download:
                  </p>
                  <button
                    onClick={() => setShowTemplateSelector(showTemplateSelector === msg.id ? null : msg.id)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {showTemplateSelector === msg.id ? "Hide templates" : "Change template"}
                  </button>
                </div>

                {showTemplateSelector === msg.id && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl.id)}
                        className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                          selectedTemplate === tmpl.id
                            ? "border-blue-500 bg-white shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white/50"
                        }`}
                      >
                        <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: tmpl.accentColor }} />
                        <p className="text-xs font-medium text-gray-800">{tmpl.name}</p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {(() => {
                    const cvData = getCVDataForMessage(msg.content);
                    return cvData ? <PDFDownloadButton data={cvData} style={selectedTemplate} /> : null;
                  })()}
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  >
                    Copy text
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-[10px] font-bold mr-2 flex-shrink-0">AI</div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Input */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-40"
            title="Attach resume (PDF/DOCX)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? "Processing your resume..." : "Ask me to build a resume, analyze a job, or attach your resume..."}
            rows={1}
            disabled={uploading}
            className="flex-1 resize-none px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm leading-relaxed bg-gray-50 focus:bg-white transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
