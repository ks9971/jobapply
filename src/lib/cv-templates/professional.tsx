"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CVData } from "./types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 20, borderBottom: "2px solid #1e40af", paddingBottom: 12 },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: "#1e40af", marginBottom: 4 },
  headline: { fontSize: 12, color: "#4b5563", marginBottom: 6 },
  contactRow: { flexDirection: "row", gap: 16, fontSize: 9, color: "#6b7280" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1e40af", borderBottom: "1px solid #e5e7eb", paddingBottom: 4, marginBottom: 8 },
  summary: { fontSize: 10, lineHeight: 1.5, color: "#374151" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, gap: 8 },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  entrySubtitle: { fontSize: 9, color: "#6b7280" },
  entryDate: { fontSize: 9, color: "#6b7280", flexShrink: 0, textAlign: "right" },
  entryDesc: { fontSize: 9, lineHeight: 1.4, color: "#374151", marginTop: 3, marginBottom: 8 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillBadge: { backgroundColor: "#eff6ff", padding: "3 8", borderRadius: 3, fontSize: 9, color: "#1e40af" },
});

export function ProfessionalTemplate({ data }: { data: CVData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{data.name}</Text>
          {data.headline && <Text style={styles.headline}>{data.headline}</Text>}
          <View style={styles.contactRow}>
            {data.email && <Text>{data.email}</Text>}
            {data.phone && <Text>{data.phone}</Text>}
            {data.location && <Text>{data.location}</Text>}
          </View>
        </View>

        {data.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROFESSIONAL SUMMARY</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </View>
        )}

        {data.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WORK EXPERIENCE</Text>
            {data.experience.map((exp, i) => (
              <View key={i}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{exp.title}</Text>
                  <Text style={styles.entryDate}>
                    {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                  </Text>
                </View>
                <Text style={styles.entrySubtitle}>
                  {exp.company}{exp.location ? ` | ${exp.location}` : ""}
                </Text>
                {exp.description && (
                  <View style={styles.entryDesc}>
                    {exp.description.split("\n").map((line, j) => (
                      <Text key={j} style={{ fontSize: 9, lineHeight: 1.4, color: "#374151", marginBottom: 2 }}>
                        {line.trim() ? `• ${line.trim()}` : ""}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EDUCATION</Text>
            {data.education.map((edu, i) => (
              <View key={i}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryTitle}>{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</Text>
                  <Text style={styles.entryDate}>
                    {edu.startYear} - {edu.endYear}
                  </Text>
                </View>
                <Text style={styles.entrySubtitle}>
                  {edu.institution}{edu.grade ? ` | ${edu.grade}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SKILLS</Text>
            <View style={styles.skillsRow}>
              {data.skills.map((skill, i) => (
                <Text key={i} style={styles.skillBadge}>
                  {skill.name}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
