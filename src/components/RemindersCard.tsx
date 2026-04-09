"use client";

import { useState, useEffect } from "react";

interface Reminder {
  id: string;
  applicationId: string | null;
  type: string;
  message: string;
  dueAt: string;
  isDone: boolean;
  application?: {
    jobTitle: string;
    company: string;
    status: string;
  } | null;
}

export default function RemindersCard() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, []);

  async function fetchReminders() {
    try {
      const res = await fetch("/api/reminders?filter=upcoming");
      if (res.ok) {
        setReminders(await res.json());
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  async function markDone(id: string) {
    const res = await fetch("/api/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDone: true }),
    });
    if (res.ok) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function snooze(id: string) {
    const res = await fetch("/api/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, snoozeDays: 2 }),
    });
    if (res.ok) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
    }
  }

  function getTimeLabel(dueAt: string) {
    const now = new Date();
    const due = new Date(dueAt);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: "text-red-600" };
    if (diffDays === 0) return { label: "Due today", color: "text-orange-600" };
    if (diffDays === 1) return { label: "Tomorrow", color: "text-yellow-600" };
    return { label: `In ${diffDays} days`, color: "text-gray-500" };
  }

  const typeIcons: Record<string, string> = {
    follow_up: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    interview_prep: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    status_check: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (reminders.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-200 mb-6">
      <div className="p-5 border-b border-orange-100 flex items-center gap-2">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-semibold text-gray-900">Upcoming Reminders</h2>
        <span className="ml-auto px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">{reminders.length}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {reminders.map((reminder) => {
          const time = getTimeLabel(reminder.dueAt);
          const iconPath = typeIcons[reminder.type] || typeIcons.follow_up;
          return (
            <div key={reminder.id} className="px-5 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{reminder.message}</p>
                {reminder.application && (
                  <p className="text-xs text-gray-500">{reminder.application.jobTitle} at {reminder.application.company}</p>
                )}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${time.color}`}>{time.label}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => snooze(reminder.id)}
                  className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                  title="Snooze 2 days"
                >
                  Snooze
                </button>
                <button
                  onClick={() => markDone(reminder.id)}
                  className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
