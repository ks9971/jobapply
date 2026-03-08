"use client";

import { useState, useEffect } from "react";

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
  const [activeTab, setActiveTab] = useState<"upload" | "generate">("upload");

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    const res = await fetch("/api/cv/upload");
    const data = await res.json();
    setDocuments(data);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/cv/upload", {
      method: "POST",
      body: formData,
    });

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

    if (res.ok) {
      fetchDocuments();
    }
    setParsing(null);
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    setGeneratedCV("");

    const formData = new FormData(e.currentTarget);
    const data = {
      targetRole: formData.get("targetRole"),
      jobDescription: formData.get("jobDescription"),
      style: formData.get("style"),
      emphasis: (formData.get("emphasis") as string)?.split(",").map((s) => s.trim()).filter(Boolean),
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
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upload" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Upload CV
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "generate" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Generate CV with AI
        </button>
      </div>

      {activeTab === "upload" && (
        <div className="space-y-6">
          {/* Upload Form */}
          <form onSubmit={handleUpload} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Upload your CV (PDF or DOCX)</h3>
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
              <div className="p-6 text-center text-gray-500">No documents uploaded yet.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{doc.filename}</p>
                      <p className="text-sm text-gray-500">
                        {doc.fileType === "generated" ? "AI Generated" : "Uploaded"} &middot;{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                        {doc.parsedData && " &middot; Parsed"}
                      </p>
                    </div>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "generate" && (
        <div className="space-y-6">
          <form onSubmit={handleGenerate} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Generate a tailored CV from your profile</h3>
            <p className="text-sm text-gray-500">Make sure your profile is filled out before generating.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Role</label>
                <input name="targetRole" placeholder="e.g. Senior Frontend Engineer" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                <select name="style" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="professional">Professional</option>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Emphasis Areas (comma separated)</label>
                <input name="emphasis" placeholder="e.g. technical skills, leadership, cloud computing" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description (optional - paste to tailor CV)</label>
                <textarea name="jobDescription" rows={5} placeholder="Paste the job description here to auto-tailor your CV..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
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

          {generatedCV && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Generated CV</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedCV)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Copy to Clipboard
                </button>
              </div>
              <div className="prose max-w-none bg-gray-50 p-6 rounded-lg border">
                <pre className="whitespace-pre-wrap text-sm">{generatedCV}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
