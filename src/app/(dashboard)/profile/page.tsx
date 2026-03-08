"use client";

import { useEffect, useState } from "react";

interface Education {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
}

interface Experience {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

interface SkillItem {
  id: string;
  name: string;
  level?: string;
}

interface Profile {
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  totalExperience?: number;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  education: Education[];
  experience: Experience[];
  skills: SkillItem[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "education" | "experience" | "skills">("basic");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const res = await fetch("/api/profile");
    const data = await res.json();
    setProfile(data);
    setLoading(false);
  }

  async function saveBasicInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data.totalExperience = data.totalExperience ? String(parseInt(data.totalExperience as string)) : "";

    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setMessage("Profile saved!");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function addEducation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    await fetch("/api/profile/education", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    e.currentTarget.reset();
    fetchProfile();
  }

  async function deleteEducation(id: string) {
    await fetch(`/api/profile/education?id=${id}`, { method: "DELETE" });
    fetchProfile();
  }

  async function addExperience(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(formData.entries());
    data.current = formData.get("current") === "on";

    await fetch("/api/profile/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    e.currentTarget.reset();
    fetchProfile();
  }

  async function deleteExperience(id: string) {
    await fetch(`/api/profile/experience?id=${id}`, { method: "DELETE" });
    fetchProfile();
  }

  async function addSkill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    await fetch("/api/profile/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    e.currentTarget.reset();
    fetchProfile();
  }

  async function deleteSkill(id: string) {
    await fetch(`/api/profile/skills?id=${id}`, { method: "DELETE" });
    fetchProfile();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading profile...</div>;
  }

  const tabs = [
    { id: "basic" as const, label: "Basic Info" },
    { id: "education" as const, label: "Education" },
    { id: "experience" as const, label: "Experience" },
    { id: "skills" as const, label: "Skills" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h1>

      {message && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Basic Info Tab */}
      {activeTab === "basic" && (
        <form onSubmit={saveBasicInfo} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" defaultValue={profile?.phone || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input name="location" defaultValue={profile?.location || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
              <input name="headline" defaultValue={profile?.headline || ""} placeholder="e.g. Senior Software Engineer" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea name="summary" rows={4} defaultValue={profile?.summary || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience (months)</label>
              <input name="totalExperience" type="number" defaultValue={profile?.totalExperience || ""} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period</label>
              <input name="noticePeriod" defaultValue={profile?.noticePeriod || ""} placeholder="e.g. 30 days" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Salary</label>
              <input name="currentSalary" defaultValue={profile?.currentSalary || ""} placeholder="e.g. 12 LPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Salary</label>
              <input name="expectedSalary" defaultValue={profile?.expectedSalary || ""} placeholder="e.g. 18 LPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      )}

      {/* Education Tab */}
      {activeTab === "education" && (
        <div className="space-y-6">
          <form onSubmit={addEducation} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Add Education</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                <input name="institution" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
                <input name="degree" required placeholder="e.g. B.Tech" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field of Study</label>
                <input name="field" placeholder="e.g. Computer Science" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade/CGPA</label>
                <input name="grade" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                <input name="startYear" type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                <input name="endYear" type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Add Education
            </button>
          </form>

          {profile?.education.map((edu) => (
            <div key={edu.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-gray-900">{edu.degree} {edu.field && `in ${edu.field}`}</h4>
                <p className="text-gray-600">{edu.institution}</p>
                <p className="text-sm text-gray-400">{edu.startYear} - {edu.endYear || "Present"} {edu.grade && `| ${edu.grade}`}</p>
              </div>
              <button onClick={() => deleteEducation(edu.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Experience Tab */}
      {activeTab === "experience" && (
        <div className="space-y-6">
          <form onSubmit={addExperience} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Add Experience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input name="company" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input name="title" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input name="location" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input name="current" type="checkbox" className="rounded border-gray-300" />
                  Currently working here
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input name="startDate" type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input name="endDate" type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" rows={3} placeholder="Key responsibilities and achievements..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Add Experience
            </button>
          </form>

          {profile?.experience.map((exp) => (
            <div key={exp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-gray-900">{exp.title}</h4>
                <p className="text-gray-600">{exp.company} {exp.location && `- ${exp.location}`}</p>
                <p className="text-sm text-gray-400">
                  {exp.startDate ? new Date(exp.startDate).toLocaleDateString() : ""} - {exp.current ? "Present" : exp.endDate ? new Date(exp.endDate).toLocaleDateString() : ""}
                </p>
                {exp.description && <p className="text-sm text-gray-500 mt-2">{exp.description}</p>}
              </div>
              <button onClick={() => deleteExperience(exp.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
            </div>
          ))}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === "skills" && (
        <div className="space-y-6">
          <form onSubmit={addSkill} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Add Skill</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Name</label>
                <input name="name" required placeholder="e.g. React, Python, AWS" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <select name="level" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              Add Skill
            </button>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-wrap gap-2">
              {profile?.skills.map((skill) => (
                <span key={skill.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {skill.name}
                  <span className="text-xs text-blue-400">({skill.level})</span>
                  <button onClick={() => deleteSkill(skill.id)} className="ml-1 text-blue-400 hover:text-red-500">&times;</button>
                </span>
              ))}
              {profile?.skills.length === 0 && (
                <p className="text-gray-500 text-sm">No skills added yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
