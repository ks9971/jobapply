"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface GmailStatus {
  connected: boolean;
  email?: string;
  authUrl?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    fetchGmailStatus();
  }, []);

  async function fetchGmailStatus() {
    const res = await fetch("/api/gmail");
    if (res.ok) {
      setGmail(await res.json());
    }
  }

  async function disconnectGmail() {
    if (!confirm("Disconnect Gmail? You'll stop receiving email tracking updates.")) return;
    await fetch("/api/gmail", { method: "DELETE" });
    setGmail({ connected: false });
    fetchGmailStatus();
  }

  async function scanEmails() {
    setScanning(true);
    setScanResult(null);
    const res = await fetch("/api/gmail/scan", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setScanResult(`Scanned ${data.scanned} emails, found ${data.newEmails?.length || 0} new job-related emails.`);
    } else {
      const err = await res.json();
      setScanResult(`Error: ${err.error}`);
    }
    setScanning(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Account Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Name</label>
            <p className="font-medium text-gray-900">{session?.user?.name || "Not set"}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium text-gray-900">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Gmail Integration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Gmail Integration</h3>
            <p className="text-sm text-gray-500">Connect Gmail to send applications and track responses automatically</p>
          </div>
        </div>

        {gmail === null ? (
          <div className="animate-pulse h-16 bg-gray-50 rounded-lg" />
        ) : gmail.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-green-800">Connected</p>
                  <p className="text-sm text-green-600">{gmail.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={scanEmails}
                  disabled={scanning}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                >
                  {scanning ? "Scanning..." : "Scan Emails Now"}
                </button>
                <button
                  onClick={disconnectGmail}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>
            </div>
            {scanResult && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{scanResult}</p>
            )}
            <div className="text-sm text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">What Gmail integration does:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>Sends job application emails directly from your Gmail</li>
                <li>Scans for interview invites, rejections, and offers</li>
                <li>Auto-updates your application status based on email responses</li>
                <li>Sends follow-up emails when companies don&apos;t respond</li>
              </ul>
            </div>
          </div>
        ) : (
          <div>
            {gmail.authUrl ? (
              <a
                href={gmail.authUrl}
                className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect Gmail Account
              </a>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
                Gmail integration requires Google Cloud setup. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Portal Credentials */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">Portal Credentials</h3>
        <p className="text-sm text-gray-500 mb-4">
          Connect your job portal accounts to enable auto-apply. Credentials are encrypted.
        </p>
        <div className="space-y-4">
          {["Naukri", "LinkedIn", "Indeed"].map((portal) => (
            <div key={portal} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{portal}</p>
                <p className="text-xs text-gray-500">Not connected</p>
              </div>
              <span className="px-3 py-1.5 bg-gray-200 text-gray-500 rounded-lg text-xs font-medium">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
