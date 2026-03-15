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

export default function AICoachPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [profileData, setProfileData] = useState<CVData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>("professional");
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
              I can build your resume, write cover letters, analyze job matches, and give personalized career advice. Just ask.
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

            {/* PDF Download bar */}
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
                  {profileData && (
                    <PDFDownloadButton data={profileData} style={selectedTemplate} />
                  )}
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

      {/* Input */}
      <div className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to build a resume, analyze a job, or anything career-related..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm leading-relaxed bg-gray-50 focus:bg-white transition-colors"
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
