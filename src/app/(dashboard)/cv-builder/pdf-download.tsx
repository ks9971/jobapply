"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { CVTemplate, type CVData, type TemplateStyle } from "@/lib/cv-templates";

export function PDFDownloadButton({
  data,
  style,
}: {
  data: CVData;
  style: TemplateStyle;
}) {
  return (
    <PDFDownloadLink
      document={<CVTemplate data={data} style={style} />}
      fileName={`cv-${style}-${Date.now()}.pdf`}
    >
      {({ loading }) => (
        <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer">
          {loading ? "Preparing PDF..." : "Download PDF"}
        </span>
      )}
    </PDFDownloadLink>
  );
}
