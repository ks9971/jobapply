"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CVData } from "./types";

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  header: { marginBottom: 28, textAlign: "center" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginBottom: 6 },
  headline: { fontSize: 11, color: "#6b7280", marginBottom: 8 },
  contactRow: { flexDirection: "row", justifyContent: "center", gap: 20, fontSize: 9, color: "#9ca3af" },
  divider: { borderBottom: "1px solid #e5e7eb", marginVertical: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 },
  summary: { fontSize: 10, lineHeight: 1.6, color: "#4b5563", textAlign: "center" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, gap: 8 },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  entrySubtitle: { fontSize: 9, color: "#6b7280" },
  entryDate: { fontSize: 9, color: "#9ca3af", flexShrink: 0, textAlign: "right" },
  entryDesc: { fontSize: 9, lineHeight: 1.4, color: "#4b5563", marginTop: 3, marginBottom: 10 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  skillText: { fontSize: 9, color: "#4b5563" },
});

export function MinimalTemplate({ data }: { data: CVData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{data.name.toUpperCase()}</Text>
          {data.headline && <Text style={styles.headline}>{data.headline}</Text>}
          <View style={styles.contactRow}>
            {data.email && <Text>{data.email}</Text>}
            {data.phone && <Text>{data.phone}</Text>}
            {data.location && <Text>{data.location}</Text>}
          </View>
        </View>

        {data.summary && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.summary}>{data.summary}</Text>
            </View>
          </>
        )}

        {data.experience.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Experience</Text>
              {data.experience.map((exp, i) => (
                <View key={i}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{exp.title}</Text>
                    <Text style={styles.entryDate}>
                      {exp.startDate} — {exp.current ? "Present" : exp.endDate}
                    </Text>
                  </View>
                  <Text style={styles.entrySubtitle}>{exp.company}</Text>
                  {exp.description && (
                    <View style={styles.entryDesc}>
                      {exp.description.split("\n").map((line, j) => (
                        <Text key={j} style={{ fontSize: 9, lineHeight: 1.4, color: "#4b5563", marginBottom: 2 }}>
                          {line.trim() ? `• ${line.trim()}` : ""}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {data.education.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Education</Text>
              {data.education.map((edu, i) => (
                <View key={i} style={{ marginBottom: 6 }}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{edu.degree}{edu.field ? `, ${edu.field}` : ""}</Text>
                    <Text style={styles.entryDate}>{edu.startYear} — {edu.endYear}</Text>
                  </View>
                  <Text style={styles.entrySubtitle}>{edu.institution}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.skills.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <View style={styles.skillsRow}>
                {data.skills.map((skill, i) => (
                  <Text key={i} style={styles.skillText}>
                    {skill.name}{i < data.skills.length - 1 ? "  ·  " : ""}
                  </Text>
                ))}
              </View>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}
