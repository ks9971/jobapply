"use client";

import type { CVData, TemplateStyle } from "./types";
import { ProfessionalTemplate } from "./professional";
import { ModernTemplate } from "./modern";
import { MinimalTemplate } from "./minimal";
import { CreativeTemplate } from "./creative";

export { TEMPLATES } from "./types";
export type { CVData, TemplateStyle, TemplateInfo } from "./types";

export function CVTemplate({ data, style }: { data: CVData; style: TemplateStyle }) {
  switch (style) {
    case "modern":
      return <ModernTemplate data={data} />;
    case "minimal":
      return <MinimalTemplate data={data} />;
    case "creative":
      return <CreativeTemplate data={data} />;
    default:
      return <ProfessionalTemplate data={data} />;
  }
}
