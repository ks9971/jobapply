export interface CVData {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  education: {
    institution: string;
    degree: string;
    field: string;
    startYear: number;
    endYear: number;
    grade: string;
  }[];
  experience: {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  }[];
  skills: { name: string; level: string }[];
}

export type TemplateStyle = "professional" | "modern" | "minimal" | "creative";

export interface TemplateInfo {
  id: TemplateStyle;
  name: string;
  description: string;
  accentColor: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "professional",
    name: "Professional",
    description: "Clean, traditional layout ideal for corporate roles",
    accentColor: "#1e40af",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with bold headers and color accents",
    accentColor: "#7c3aed",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Simple and elegant with generous whitespace",
    accentColor: "#374151",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Standout design for design and creative roles",
    accentColor: "#059669",
  },
];
