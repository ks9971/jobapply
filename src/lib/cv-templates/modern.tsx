"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CVData } from "./types";

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { backgroundColor: "#7c3aed", padding: "30 40 24 40", color: "#ffffff" },
  name: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  headline: { fontSize: 13, color: "#e0d4fc", marginBottom: 8 },
  contactRow: { flexDirection: "row", gap: 16, fontSize: 9, color: "#ddd6fe" },
  body: { padding: "20 40 40 40" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#7c3aed", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  summary: { fontSize: 10, lineHeight: 1.5, color: "#374151" },
  entryContainer: { marginBottom: 10, paddingLeft: 10, borderLeft: "2px solid #7c3aed" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, gap: 8 },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  entrySubtitle: { fontSize: 9, color: "#7c3aed", fontFamily: "Helvetica-Bold" },
  entryDate: { fontSize: 9, color: "#6b7280", flexShrink: 0, textAlign: "right" },
  entryDesc: { fontSize: 9, lineHeight: 1.4, color: "#374151", marginTop: 3 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillBadge: { backgroundColor: "#f5f3ff", padding: "4 10", borderRadius: 12, fontSize: 9, color: "#7c3aed", border: "1px solid #ddd6fe" },
});

export function ModernTemplate({ data }: { data: CVData }) {
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

        <View style={styles.body}>
          {data.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About Me</Text>
              <Text style={styles.summary}>{data.summary}</Text>
            </View>
          )}

          {data.experience.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Experience</Text>
              {data.experience.map((exp, i) => (
                <View key={i} style={styles.entryContainer}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{exp.title}</Text>
                    <Text style={styles.entryDate}>
                      {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                    </Text>
                  </View>
                  <Text style={styles.entrySubtitle}>{exp.company}</Text>
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
              <Text style={styles.sectionTitle}>Education</Text>
              {data.education.map((edu, i) => (
                <View key={i} style={styles.entryContainer}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{edu.degree}{edu.field ? ` in ${edu.field}` : ""}</Text>
                    <Text style={styles.entryDate}>{edu.startYear} - {edu.endYear}</Text>
                  </View>
                  <Text style={styles.entrySubtitle}>{edu.institution}</Text>
                </View>
              ))}
            </View>
          )}

          {data.skills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills</Text>
              <View style={styles.skillsRow}>
                {data.skills.map((skill, i) => (
                  <Text key={i} style={styles.skillBadge}>{skill.name}</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
