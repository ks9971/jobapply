"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [step, setStep] = useState<"upload" | "uploading" | "parsing" | "done">("upload");
  const [error, setError] = useState("");
  const [parsedName, setParsedName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileUpload(file: File) {
    setError("");
    setStep("uploading");

    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/cv/upload", { method: "POST", body: formData });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const doc = await uploadRes.json();
      setStep("parsing");

      // Step 2: Parse with AI and auto-populate profile
      const parseRes = await fetch("/api/cv/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });

      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || "Failed to parse CV");
      }

      const result = await parseRes.json();
      setParsedName(result.parsedData?.name || "");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("upload");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Let&apos;s set up your profile</h1>
          <p className="text-gray-500 mt-2">
            Upload your CV and we&apos;ll automatically fill in your profile with your skills, experience, and education.
          </p>
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">Drop your CV here or click to browse</p>
            <p className="text-sm text-gray-500">Supports PDF and DOCX files</p>
          </div>
        )}

        {/* Uploading */}
        {step === "uploading" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="animate-spin w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Uploading your CV...</p>
            <p className="text-sm text-gray-500 mt-1">This will only take a moment</p>
          </div>
        )}

        {/* Parsing */}
        {step === "parsing" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="animate-spin w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">AI is reading your CV...</p>
            <p className="text-sm text-gray-500 mt-1">Extracting skills, experience, and education</p>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="bg-white border border-green-200 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 text-lg">
              {parsedName ? `Welcome, ${parsedName}!` : "Profile set up!"}
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Your profile has been auto-filled from your CV. You can review and edit it anytime.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push("/profile")}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Review Profile
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Skip option — go to AI Coach instead */}
        {step === "upload" && (
          <p className="text-center mt-6 text-sm text-gray-400">
            Don&apos;t have a CV?{" "}
            <button
              onClick={() => router.push("/ai-coach")}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Chat with AI Coach to build one
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
