"use client";

import { useState, useEffect } from "react";

interface AnalyticsData {
  overview: {
    totalApplications: number;
    thisWeek: number;
    thisMonth: number;
    responseRate: number;
  };
  funnel: {
    applied: number;
    screening: number;
    interview: number;
    offer: number;
    rejected: number;
  };
  weeklyVolume: { week: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  topCompanies: { company: string; count: number; lastStatus: string }[];
}

const statusColors: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-cyan-100 text-cyan-700",
  interview: "bg-green-100 text-green-700",
  offer: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-7 w-40 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-48 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-3/4 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load analytics</h2>
          <p className="text-sm text-gray-500 mb-5">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, funnel, weeklyVolume, statusBreakdown, topCompanies } = data;
  const maxWeeklyCount = Math.max(...weeklyVolume.map((w) => w.count), 1);

  const funnelSteps = [
    { label: "Applied", count: funnel.applied, color: "bg-blue-500" },
    { label: "Screening", count: funnel.screening, color: "bg-cyan-500" },
    { label: "Interview", count: funnel.interview, color: "bg-green-500" },
    { label: "Offer", count: funnel.offer, color: "bg-purple-500" },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Track your job search progress and performance</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Applications", value: overview.totalApplications, color: "text-blue-600", bg: "bg-blue-50", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
          { label: "This Week", value: overview.thisWeek, color: "text-green-600", bg: "bg-green-50", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          { label: "This Month", value: overview.thisMonth, color: "text-orange-600", bg: "bg-orange-50", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
          { label: "Response Rate", value: `${overview.responseRate}%`, color: "text-purple-600", bg: "bg-purple-50", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
                <svg className={`w-4 h-4 ${card.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-5">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => {
              const pct = funnel.applied > 0 ? Math.round((step.count / funnel.applied) * 100) : 0;
              const barWidth = funnel.applied > 0 ? Math.max((step.count / funnel.applied) * 100, 4) : 4;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700 font-medium">{step.label}</span>
                    <span className="text-sm text-gray-500">
                      {step.count} ({i === 0 ? "100" : pct}%)
                    </span>
                  </div>
                  <div className="h-7 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded-lg transition-all duration-500`}
                      style={{ width: `${i === 0 ? 100 : barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {funnel.applied > 0 && funnel.offer > 0 && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              Overall conversion: {Math.round((funnel.offer / funnel.applied) * 100)}% from application to offer
            </p>
          )}
        </div>

        {/* Weekly Volume */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-5">Weekly Volume</h2>
          {weeklyVolume.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data available yet</div>
          ) : (
            <div className="flex items-end gap-2 h-48">
              {weeklyVolume.map((week) => {
                const heightPct = Math.max((week.count / maxWeeklyCount) * 100, 4);
                return (
                  <div key={week.week} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">{week.count}</span>
                    <div className="w-full flex items-end" style={{ height: "160px" }}>
                      <div
                        className="w-full bg-blue-500 hover:bg-blue-600 rounded-t-md transition-all duration-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight text-center">{week.week}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Status Breakdown</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-gray-400 text-sm">No applications tracked yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {statusBreakdown.map((item) => {
                const colors = statusColors[item.status] || "bg-gray-100 text-gray-600";
                return (
                  <span key={item.status} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${colors}`}>
                    {item.status.replace(/_/g, " ")}
                    <span className="opacity-70">{item.count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Companies */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Top Companies</h2>
          </div>
          {topCompanies.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No companies tracked yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              <div className="grid grid-cols-3 px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Company</span>
                <span className="text-center">Applications</span>
                <span className="text-right">Last Status</span>
              </div>
              {topCompanies.map((company) => {
                const colors = statusColors[company.lastStatus] || "bg-gray-100 text-gray-600";
                return (
                  <div key={company.company} className="grid grid-cols-3 px-5 py-3 items-center hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-gray-900 font-medium truncate">{company.company}</span>
                    <span className="text-sm text-gray-500 text-center">{company.count}</span>
                    <div className="flex justify-end">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
                        {company.lastStatus.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
