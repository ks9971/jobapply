export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  totalExperience?: number;
  currentSalary?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  education: Education[];
  experience: WorkExperience[];
  skills: Skill[];
  jobPreference?: JobPreference;
}

export interface Education {
  id?: string;
  institution: string;
  degree: string;
  field?: string;
  startYear?: number;
  endYear?: number;
  grade?: string;
}

export interface WorkExperience {
  id?: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface Skill {
  id?: string;
  name: string;
  level?: "beginner" | "intermediate" | "expert";
}

export interface JobPreference {
  roles: string[];
  locations: string[];
  minSalary?: number;
  maxSalary?: number;
  jobType?: string;
  remote?: boolean;
  industries: string[];
  experienceLevel?: string;
}

export interface ApplicationEntry {
  id: string;
  jobTitle: string;
  company: string;
  jobUrl?: string;
  portal: "naukri" | "linkedin" | "indeed" | "manual";
  status: "applied" | "in_review" | "interview" | "rejected" | "offered";
  appliedAt: Date;
  cvUsed?: string;
  notes?: string;
}
