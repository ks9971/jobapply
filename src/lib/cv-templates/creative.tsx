"use client";

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CVData } from "./types";

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  sidebar: { position: "absolute", top: 0, left: 0, bottom: 0, width: 200, backgroundColor: "#064e3b", padding: "36 20", color: "#ffffff" },
  sidebarName: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sidebarHeadline: { fontSize: 10, color: "#a7f3d0", marginBottom: 16 },
  sidebarSection: { marginBottom: 16 },
  sidebarLabel: { fontSize: 8, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  sidebarText: { fontSize: 9, color: "#d1fae5", lineHeight: 1.5 },
  skillItem: { marginBottom: 6 },
  skillName: { fontSize: 9, color: "#ffffff", marginBottom: 2 },
  skillBar: { height: 4, borderRadius: 2, backgroundColor: "#065f46" },
  skillFill: { height: 4, borderRadius: 2, backgroundColor: "#34d399" },
  main: { marginLeft: 220, padding: "36 36 36 20" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#059669", marginBottom: 8, borderBottom: "2px solid #d1fae5", paddingBottom: 4 },
  summary: { fontSize: 10, lineHeight: 1.5, color: "#374151" },
  entryContainer: { marginBottom: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, gap: 8 },
  entryTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#064e3b", flex: 1 },
  entrySubtitle: { fontSize: 9, color: "#059669", fontFamily: "Helvetica-Bold" },
  entryDate: { fontSize: 9, color: "#6b7280", flexShrink: 0, textAlign: "right" },
  entryDesc: { fontSize: 9, lineHeight: 1.4, color: "#374151", marginTop: 3 },
});

function getSkillWidth(level: string): string {
  switch (level) {
    case "expert": return "90%";
    case "intermediate": return "65%";
    default: return "40%";
  }
}

export function CreativeTemplate({ data }: { data: CVData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarName}>{data.name}</Text>
          {data.headline && <Text style={styles.sidebarHeadline}>{data.headline}</Text>}

          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarLabel}>Contact</Text>
            {data.email && <Text style={styles.sidebarText}>{data.email}</Text>}
            {data.phone && <Text style={styles.sidebarText}>{data.phone}</Text>}
            {data.location && <Text style={styles.sidebarText}>{data.location}</Text>}
          </View>

          {data.skills.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarLabel}>Skills</Text>
              {data.skills.map((skill, i) => (
                <View key={i} style={styles.skillItem}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <View style={styles.skillBar}>
                    <View style={[styles.skillFill, { width: getSkillWidth(skill.level) }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {data.education.length > 0 && (
            <View style={styles.sidebarSection}>
              <Text style={styles.sidebarLabel}>Education</Text>
              {data.education.map((edu, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 9, color: "#ffffff", fontFamily: "Helvetica-Bold" }}>
                    {edu.degree}
                  </Text>
                  <Text style={styles.sidebarText}>{edu.institution}</Text>
                  <Text style={{ fontSize: 8, color: "#a7f3d0" }}>
                    {edu.startYear} - {edu.endYear}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Main Content */}
        <View style={styles.main}>
          {data.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile</Text>
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
        </View>
      </Page>
    </Document>
  );
}
