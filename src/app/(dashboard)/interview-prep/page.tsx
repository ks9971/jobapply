"use client";

import { useState, useEffect } from "react";

interface PrepQuestion {
  question: string;
  suggestedAnswer: string;
  category: string;
  difficulty: string;
}

interface PrepKit {
  id: string;
  jobTitle: string;
  company: string | null;
  prepType: string;
  questions: string;
  companyInsights: string | null;
  tips: string | null;
  createdAt: string;
}

interface ParsedPrepKit extends Omit<PrepKit, "questions"> {
  questions: PrepQuestion[];
}

interface MockState {
  status: "idle" | "answering" | "scored" | "done";
  sessionId: string | null;
  question: string | null;
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  score: number | null;
  feedback: string | null;
  totalScore: number | null;
  overallFeedback: string | null;
}

const categoryColors: Record<string, string> = {
  Technical: "bg-blue-100 text-blue-800",
  HR: "bg-green-100 text-green-800",
  Behavioral: "bg-purple-100 text-purple-800",
  Situational: "bg-orange-100 text-orange-800",
};

const difficultyColors: Record<string, string> = {
  Easy: "text-green-600",
  Medium: "text-yellow-600",
  Hard: "text-red-600",
};

export default function InterviewPrepPage() {
  const [pastPreps, setPastPreps] = useState<ParsedPrepKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mock interview state
  const [mock, setMock] = useState<MockState>({
    status: "idle",
    sessionId: null,
    question: null,
    questionIndex: 0,
    totalQuestions: 0,
    answer: "",
    score: null,
    feedback: null,
    totalScore: null,
    overallFeedback: null,
  });
  const [mockJobTitle, setMockJobTitle] = useState("");
  const [mockLoading, setMockLoading] = useState(false);

  useEffect(() => {
    fetchPastPreps();
  }, []);

  async function fetchPastPreps() {
    try {
      const res = await fetch("/api/interview/prep");
      if (!res.ok) throw new Error("Failed to load past preps");
      const data: PrepKit[] = await res.json();
      setPastPreps(
        data.map((p) => ({
          ...p,
          questions: safeParseQuestions(p.questions),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function safeParseQuestions(raw: string): PrepQuestion[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      jobTitle: formData.get("jobTitle") as string,
      company: (formData.get("company") as string) || undefined,
      prepType: formData.get("prepType") as string,
      jobDescription: (formData.get("jobDescription") as string) || undefined,
    };

    try {
      const res = await fetch("/api/interview/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to generate prep kit");
      const data = await res.json();
      const newPrep: ParsedPrepKit = {
        id: data.id,
        jobTitle: payload.jobTitle,
        company: payload.company || null,
        prepType: payload.prepType,
        questions: data.questions || [],
        companyInsights: data.companyInsights || null,
        tips: data.tips || null,
        createdAt: new Date().toISOString(),
      };
      setPastPreps((prev) => [newPrep, ...prev]);
      setExpandedId(data.id);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function startMock() {
    if (!mockJobTitle.trim()) {
      setError("Enter a job title for the mock interview");
      return;
    }
    setMockLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: mockJobTitle }),
      });
      if (!res.ok) throw new Error("Failed to start mock interview");
      const data = await res.json();
      setMock({
        status: "answering",
        sessionId: data.sessionId,
        question: data.currentQuestion.question,
        questionIndex: data.currentQuestion.index,
        totalQuestions: data.totalQuestions,
        answer: "",
        score: null,
        feedback: null,
        totalScore: null,
        overallFeedback: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start mock");
    } finally {
      setMockLoading(false);
    }
  }

  async function submitAnswer() {
    if (!mock.sessionId || !mock.answer.trim()) return;
    setMockLoading(true);
    try {
      const res = await fetch("/api/interview/mock/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: mock.sessionId,
          answer: mock.answer,
          questionIndex: mock.questionIndex,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      const data = await res.json();

      if (data.completed) {
        setMock((prev) => ({
          ...prev,
          status: "done",
          score: data.score,
          feedback: data.feedback,
          totalScore: data.totalScore ?? null,
          overallFeedback: data.overallFeedback ?? null,
        }));
      } else {
        setMock((prev) => ({
          ...prev,
          status: "scored",
          score: data.score,
          feedback: data.feedback,
          question: data.nextQuestion?.question ?? prev.question,
          questionIndex: data.nextQuestion?.index ?? prev.questionIndex + 1,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setMockLoading(false);
    }
  }

  function nextQuestion() {
    setMock((prev) => ({
      ...prev,
      status: "answering",
      answer: "",
      score: null,
      feedback: null,
    }));
  }

  function resetMock() {
    setMock({
      status: "idle",
      sessionId: null,
      question: null,
      questionIndex: 0,
      totalQuestions: 0,
      answer: "",
      score: null,
      feedback: null,
      totalScore: null,
      overallFeedback: null,
    });
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
              <div className="h-3 w-64 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interview Prep</h1>
          <p className="text-gray-500 mt-1">AI-powered interview preparation and mock interviews</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showForm ? "Cancel" : "Generate Prep Kit"}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-sm font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Generate Form */}
      {showForm && (
        <form onSubmit={handleGenerate} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input
                name="jobTitle"
                required
                placeholder="e.g. Senior Frontend Developer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
              <input
                name="company"
                placeholder="e.g. Google, Infosys"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prep Type</label>
              <select
                name="prepType"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="full">Full</option>
                <option value="technical">Technical</option>
                <option value="hr">HR</option>
                <option value="behavioral">Behavioral</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Description (optional)</label>
            <textarea
              name="jobDescription"
              rows={3}
              placeholder="Paste the job description here for more targeted questions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        </form>
      )}

      {/* Mock Interview Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Mock Interview</h2>
            <p className="text-sm text-gray-500">Practice with AI-generated questions and get instant feedback</p>
          </div>
          {mock.status === "idle" && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mockJobTitle}
                onChange={(e) => setMockJobTitle(e.target.value)}
                placeholder="Job title, e.g. React Developer"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56"
              />
              <button
                onClick={startMock}
                disabled={mockLoading || !mockJobTitle.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 text-sm font-medium disabled:opacity-50"
              >
                {mockLoading ? "Starting..." : "Start Mock"}
              </button>
            </div>
          )}
          {(mock.status === "done" || mock.status === "answering" || mock.status === "scored") && (
            <button
              onClick={resetMock}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>

        {/* Answering State */}
        {mock.status === "answering" && mock.question && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span className="font-medium">
                Question {mock.questionIndex + 1} of {mock.totalQuestions}
              </span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${((mock.questionIndex + 1) / mock.totalQuestions) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-gray-900 font-medium">{mock.question}</p>
            </div>
            <textarea
              value={mock.answer}
              onChange={(e) => setMock((prev) => ({ ...prev, answer: e.target.value }))}
              rows={5}
              placeholder="Type your answer here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={submitAnswer}
              disabled={mockLoading || !mock.answer.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mockLoading ? "Evaluating..." : "Submit Answer"}
            </button>
          </div>
        )}

        {/* Scored State */}
        {mock.status === "scored" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{mock.score}</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Score</p>
                <p className="text-lg font-semibold text-gray-900">{mock.score}/10</p>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-sm font-medium text-blue-900 mb-1">Feedback</p>
              <p className="text-sm text-blue-800">{mock.feedback}</p>
            </div>
            <button
              onClick={nextQuestion}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Next Question
            </button>
          </div>
        )}

        {/* Done State */}
        {mock.status === "done" && (
          <div className="space-y-4">
            {mock.score !== null && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 mb-2">
                <p className="text-sm font-medium text-blue-900 mb-1">Last Answer Feedback</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{mock.score}</span>
                  </div>
                  <span className="text-sm text-blue-800">{mock.score}/10</span>
                </div>
                {mock.feedback && <p className="text-sm text-blue-800">{mock.feedback}</p>}
              </div>
            )}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Mock Interview Complete</h3>
              {mock.totalScore !== null && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-2xl font-bold">{mock.totalScore}</span>
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Total Score</p>
                    <p className="text-lg font-semibold">{mock.totalScore} / {mock.totalQuestions * 10}</p>
                  </div>
                </div>
              )}
              {mock.overallFeedback && (
                <p className="text-sm opacity-90 leading-relaxed">{mock.overallFeedback}</p>
              )}
            </div>
            <button
              onClick={resetMock}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Start New Mock Interview
            </button>
          </div>
        )}

        {/* Idle State - empty message */}
        {mock.status === "idle" && !mockLoading && (
          <div className="text-center py-6 text-gray-400 text-sm">
            Click &quot;Start Mock Interview&quot; to begin a practice session with AI-generated questions.
          </div>
        )}
      </div>

      {/* Past Preps */}
      <div>
        <h2 className="font-semibold text-gray-900 text-lg mb-4">Past Prep Kits</h2>
        {pastPreps.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            No prep kits generated yet. Click &quot;Generate Prep Kit&quot; to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {pastPreps.map((prep) => {
              const isExpanded = expandedId === prep.id;
              return (
                <div key={prep.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : prep.id)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{prep.jobTitle}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[prep.prepType] || "bg-gray-100 text-gray-800"}`}>
                          {prep.prepType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {prep.company && `${prep.company} · `}
                        {new Date(prep.createdAt).toLocaleDateString()} · {prep.questions.length} questions
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {/* Company Insights */}
                      {prep.companyInsights && (
                        <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-100 mb-4">
                          <p className="text-sm font-medium text-blue-900 mb-1">Company Insights</p>
                          <p className="text-sm text-blue-800 whitespace-pre-line">{prep.companyInsights}</p>
                        </div>
                      )}

                      {/* Tips */}
                      {prep.tips && (
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100 mb-4">
                          <p className="text-sm font-medium text-green-900 mb-1">Tips</p>
                          <p className="text-sm text-green-800 whitespace-pre-line">{prep.tips}</p>
                        </div>
                      )}

                      {/* Questions */}
                      <div className="space-y-3">
                        {prep.questions.map((q, i) => (
                          <div key={i} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-gray-400">Q{i + 1}</span>
                              {q.category && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[q.category] || "bg-gray-100 text-gray-800"}`}>
                                  {q.category}
                                </span>
                              )}
                              {q.difficulty && (
                                <span className={`text-xs font-medium ${difficultyColors[q.difficulty] || "text-gray-500"}`}>
                                  {q.difficulty}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-2">{q.question}</p>
                            {q.suggestedAnswer && (
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-xs font-medium text-gray-500 mb-1">Suggested Answer</p>
                                <p className="text-sm text-gray-700 whitespace-pre-line">{q.suggestedAnswer}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
