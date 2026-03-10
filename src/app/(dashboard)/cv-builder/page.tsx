"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Markdown from "react-markdown";
import { TEMPLATES, type TemplateStyle, type CVData } from "@/lib/cv-templates";

const PDFDownloadButton = dynamic(
  () => import("./pdf-download").then((mod) => ({ default: mod.PDFDownloadButton })),
  { ssr: false, loading: () => <span className="text-sm text-gray-400">Loading PDF...</span> }
);

interface CVDoc {
  id: string;
  filename: string;
  fileType: string;
  createdAt: string;
  parsedData?: string;
}

export default function CVBuilderPage() {
  const [documents, setDocuments] = useState<CVDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedCV, setGeneratedCV] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>("professional");
  const [activeTab, setActiveTab] = useState<"upload" | "generate">("upload");
  const [profileData, setProfileData] = useState<CVData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch("/api/cv/upload");
    const data = await res.json();
    setDocuments(data);
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchProfile();
  }, [fetchDocuments]);

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

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
    if (res.ok) {
      e.currentTarget.reset();
      fetchDocuments();
    }
    setUploading(false);
  }

  async function handleParse(documentId: string) {
    setParsing(documentId);
    const res = await fetch("/api/cv/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    if (res.ok) fetchDocuments();
    setParsing(null);
  }

  async function handleDelete(documentId: string) {
    setDeleting(documentId);
    const res = await fetch(`/api/cv/${documentId}`, { method: "DELETE" });
    if (res.ok) fetchDocuments();
    setDeleting(null);
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    setGeneratedCV("");

    const formData = new FormData(e.currentTarget);
    const data = {
      targetRole: formData.get("targetRole"),
      jobDescription: formData.get("jobDescription"),
      style: selectedTemplate,
      emphasis: (formData.get("emphasis") as string)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/cv/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const result = await res.json();
      setGeneratedCV(result.content);
      fetchDocuments();
    }
    setGenerating(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">CV Builder</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["upload", "generate"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "upload" ? "Upload CV" : "Generate CV with AI"}
          </button>
        ))}
      </div>

      {activeTab === "upload" && (
        <div className="space-y-6">
          {/* Upload Form */}
          <form
            onSubmit={handleUpload}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <h3 className="font-semibold text-gray-900 mb-4">
              Upload your CV (PDF or DOCX)
            </h3>
            <div className="flex items-center gap-4">
              <input
                name="file"
                type="file"
                accept=".pdf,.docx"
                required
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>

          {/* Documents List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Your Documents</h3>
            </div>
            {documents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{doc.filename}</p>
                      <p className="text-sm text-gray-500">
                        {doc.fileType === "generated" ? "AI Generated" : "Uploaded"}{" "}
                        &middot; {new Date(doc.createdAt).toLocaleDateString()}
                        {doc.parsedData && " \u00b7 Parsed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.fileType === "original" && !doc.parsedData && (
                        <button
                          onClick={() => handleParse(doc.id)}
                          disabled={parsing === doc.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                        >
                          {parsing === doc.id ? "Parsing..." : "Parse with AI"}
                        </button>
                      )}
                      {doc.parsedData && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Parsed
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleting === doc.id}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 text-sm"
                      >
                        {deleting === doc.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "generate" && (
        <div className="space-y-6">
          {/* Template Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Choose a Template</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedTemplate === tmpl.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className="w-full h-2 rounded-full mb-3"
                    style={{ backgroundColor: tmpl.accentColor }}
                  />
                  <p className="font-medium text-sm text-gray-900">{tmpl.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{tmpl.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Form */}
          <form
            onSubmit={handleGenerate}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
          >
            <h3 className="font-semibold text-gray-900">
              Generate a tailored CV from your profile
            </h3>
            <p className="text-sm text-gray-500">
              Make sure your profile is filled out before generating.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Role
                </label>
                <input
                  name="targetRole"
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Template
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                  {TEMPLATES.find((t) => t.id === selectedTemplate)?.name} Template
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emphasis Areas (comma separated)
                </label>
                <input
                  name="emphasis"
                  placeholder="e.g. technical skills, leadership, cloud computing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Description (optional - paste to tailor CV)
                </label>
                <textarea
                  name="jobDescription"
                  rows={5}
                  placeholder="Paste the job description here to auto-tailor your CV..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={generating}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {generating ? "Generating CV..." : "Generate CV"}
            </button>
          </form>

          {/* Generated CV Preview */}
          {generatedCV && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h3 className="font-semibold text-gray-900">Generated CV</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedCV)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Copy Markdown
                  </button>
                  {profileData && (
                    <PDFDownloadButton
                      data={profileData}
                      style={selectedTemplate}
                    />
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none bg-gray-50 p-6 rounded-lg border">
                <Markdown>{generatedCV}</Markdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
