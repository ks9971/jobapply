"use client";

import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

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

      {/* Portal Credentials - Placeholder */}
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
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Job Preferences - Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Auto-Apply Preferences</h3>
        <p className="text-sm text-gray-500 mb-4">Configure job matching and auto-apply settings. Coming in Phase 4.</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          Auto-apply features will be available after portal automation is implemented.
        </div>
      </div>
    </div>
  );
}
