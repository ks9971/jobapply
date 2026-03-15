"use client";

import { useState, useEffect } from "react";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  jobUrl?: string;
  portal: string;
  status: string;
  appliedAt: string;
  notes?: string;
}

const statusColors: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  interview: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  offered: "bg-purple-100 text-purple-800",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    const res = await fetch("/api/applications");
    const data = await res.json();
    setApplications(data);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowForm(false);
      e.currentTarget.reset();
      fetchApplications();
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/applications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchApplications();
  }

  async function deleteApplication(id: string) {
    await fetch(`/api/applications?id=${id}`, { method: "DELETE" });
    fetchApplications();
  }

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  const stats = {
    total: applications.length,
    applied: applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offered: applications.filter((a) => a.status === "offered").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add Application"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 capitalize">{key}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input name="jobTitle" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input name="company" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
              <input name="jobUrl" type="url" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portal</label>
              <select name="portal" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="manual">Manual</option>
                <option value="naukri">Naukri</option>
                <option value="linkedin">LinkedIn</option>
                <option value="indeed">Indeed</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            Save Application
          </button>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["all", "applied", "in_review", "interview", "rejected", "offered"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === status ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "All" : status.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No applications found.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filtered.map((app) => (
              <div key={app.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{app.jobTitle}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || "bg-gray-100 text-gray-800"}`}>
                        {app.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{app.company} &middot; {app.portal}</p>
                    {app.notes && <p className="text-sm text-gray-400 mt-1">{app.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(app.appliedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value)}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="applied">Applied</option>
                      <option value="in_review">In Review</option>
                      <option value="interview">Interview</option>
                      <option value="rejected">Rejected</option>
                      <option value="offered">Offered</option>
                    </select>
                    {app.jobUrl && (
                      <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">
                        View
                      </a>
                    )}
                    <button onClick={() => deleteApplication(app.id)} className="text-red-500 hover:text-red-700 text-xs">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
