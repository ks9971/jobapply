"use client";

import { useState } from "react";

interface SalaryRange {
  min: number;
  max: number;
  median: number;
}

interface SalaryEstimate {
  role: string;
  city: string;
  experience: string;
  ranges: {
    startup: SalaryRange;
    midsize: SalaryRange;
    mnc: SalaryRange;
    faang: SalaryRange;
  };
  inHandBreakdown: {
    ctc: number;
    basic: number;
    hra: number;
    specialAllowance: number;
    pf: number;
    professionalTax: number;
    incomeTax: number;
    monthlyInHand: number;
  };
  marketInsights: string[];
  negotiationTips: string[];
}

interface SalaryComparison {
  currentCTC: string;
  marketMedian: string;
  percentile: number;
  verdict: string;
  gap: string;
  recommendation: string;
  expectedHike: {
    sameCompany: string;
    jobSwitch: string;
    targetCTC: string;
  };
  factors: string[];
}

const tierColors: Record<string, { bg: string; text: string; label: string }> = {
  startup: { bg: "bg-orange-50", text: "text-orange-700", label: "Startup" },
  midsize: { bg: "bg-blue-50", text: "text-blue-700", label: "Mid-size" },
  mnc: { bg: "bg-green-50", text: "text-green-700", label: "MNC" },
  faang: { bg: "bg-purple-50", text: "text-purple-700", label: "FAANG/Top" },
};

export default function SalaryPage() {
  const [role, setRole] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [experience, setExperience] = useState("3");
  const [currentCTC, setCurrentCTC] = useState("");

  const [estimate, setEstimate] = useState<SalaryEstimate | null>(null);
  const [comparison, setComparison] = useState<SalaryComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getEstimate() {
    if (!role.trim()) return;
    setLoading(true);
    setError(null);
    setEstimate(null);
    try {
      const res = await fetch("/api/salary/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, city, experienceYears: parseInt(experience) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setEstimate(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function comparesalary() {
    if (!currentCTC.trim()) return;
    setComparing(true);
    setError(null);
    setComparison(null);
    try {
      const res = await fetch("/api/salary/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCTC: parseFloat(currentCTC),
          role: role || undefined,
          city: city || undefined,
          experienceYears: parseInt(experience) || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setComparison(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setComparing(false);
    }
  }

  const verdictColors: Record<string, string> = {
    underpaid: "text-red-600 bg-red-50",
    fair: "text-yellow-600 bg-yellow-50",
    "well-paid": "text-green-600 bg-green-50",
    "above-market": "text-purple-600 bg-purple-50",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Salary Intelligence</h1>
        <p className="text-gray-500 mt-1">Know your market worth — salary ranges in LPA for the Indian market</p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role *</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. React Developer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {["Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Remote"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
            <input
              type="number"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              min="0"
              max="30"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={getEstimate}
              disabled={loading || !role.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Estimating..." : "Get Salary Range"}
            </button>
          </div>
        </div>

        {/* Compare section */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Current CTC (LPA)</label>
              <input
                type="number"
                value={currentCTC}
                onChange={(e) => setCurrentCTC(e.target.value)}
                placeholder="e.g. 12"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={comparesalary}
                disabled={comparing || !currentCTC.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {comparing ? "Comparing..." : "Am I Underpaid?"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">{error}</div>
      )}

      {/* Salary Estimate Results */}
      {estimate && (
        <div className="space-y-6 mb-6">
          {/* Salary Ranges by Tier */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">{estimate.role}</h2>
            <p className="text-sm text-gray-500 mb-5">{estimate.city} | {estimate.experience} experience</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.entries(estimate.ranges) as [string, SalaryRange][]).map(([tier, range]) => {
                const colors = tierColors[tier] || tierColors.startup;
                return (
                  <div key={tier} className={`${colors.bg} rounded-xl p-4 border border-gray-100`}>
                    <p className={`text-xs font-semibold ${colors.text} uppercase tracking-wide mb-2`}>{colors.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{range.median} <span className="text-sm font-normal text-gray-500">LPA</span></p>
                    <p className="text-xs text-gray-500 mt-1">{range.min} - {range.max} LPA range</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTC Breakdown */}
          {estimate.inHandBreakdown && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">CTC to In-Hand Breakdown (MNC Median)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500">Annual CTC</p>
                  <p className="text-lg font-bold text-blue-700">{estimate.inHandBreakdown.ctc} LPA</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500">Monthly In-Hand</p>
                  <p className="text-lg font-bold text-green-700">{(estimate.inHandBreakdown.monthlyInHand / 1000).toFixed(1)}K</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-gray-500">PF (Monthly)</p>
                  <p className="text-lg font-bold text-yellow-700">{(estimate.inHandBreakdown.pf / 1000).toFixed(1)}K</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500">Tax (Monthly)</p>
                  <p className="text-lg font-bold text-red-700">{(estimate.inHandBreakdown.incomeTax / 1000).toFixed(1)}K</p>
                </div>
              </div>
              <div className="text-xs text-gray-400">* Approximate calculation based on new tax regime. Actual may vary.</div>
            </div>
          )}

          {/* Insights + Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {estimate.marketInsights?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Market Insights</h3>
                <ul className="space-y-2">
                  {estimate.marketInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-500 mt-0.5">&#x2022;</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {estimate.negotiationTips?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Negotiation Tips</h3>
                <ul className="space-y-2">
                  {estimate.negotiationTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">&#x2022;</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">Salary Comparison</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${verdictColors[comparison.verdict] || "text-gray-600 bg-gray-50"}`}>
              {comparison.verdict.replace("-", " ").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Your CTC</p>
              <p className="text-xl font-bold text-gray-900">{comparison.currentCTC}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Market Median</p>
              <p className="text-xl font-bold text-blue-700">{comparison.marketMedian}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Percentile</p>
              <p className="text-xl font-bold text-green-700">{comparison.percentile}th</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 mb-4 p-3 bg-gray-50 rounded-lg">{comparison.recommendation}</p>

          {comparison.expectedHike && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500">Same Company Hike</p>
                <p className="text-sm font-semibold text-gray-900">{comparison.expectedHike.sameCompany}</p>
              </div>
              <div className="p-3 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500">Job Switch Hike</p>
                <p className="text-sm font-semibold text-gray-900">{comparison.expectedHike.jobSwitch}</p>
              </div>
              <div className="p-3 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500">Target CTC</p>
                <p className="text-sm font-semibold text-green-700">{comparison.expectedHike.targetCTC}</p>
              </div>
            </div>
          )}

          {comparison.factors?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Key Factors</h3>
              <ul className="space-y-1">
                {comparison.factors.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">&#x2022;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
