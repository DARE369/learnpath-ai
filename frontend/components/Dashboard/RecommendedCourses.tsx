import React from "react";
import Link from "next/link";
import type { Course } from "../../hooks/useDashboardData";
import { Card, Badge, type BadgeTone } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

const DIFFICULTY_TONE: Record<Course["difficulty"], BadgeTone> = {
  Beginner: "success",
  Intermediate: "warning",
  Advanced: "danger",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ""}`.trim();
}

export default function RecommendedCourses({ courses }: { courses: Course[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {courses.map((course) => (
        <Link key={course.id} href={`/learning/${course.id}/0`} style={{ textDecoration: "none" }}>
          <Card padding="sm" style={{ overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 120, position: "relative", background: course.gradient, margin: "-14px -16px 14px", width: "calc(100% + 32px)" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
              <div style={{ position: "absolute", bottom: 10, left: 14, fontSize: 32 }}>{course.icon}</div>
              <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(20,23,31,0.35)", backdropFilter: "blur(4px)", borderRadius: 100, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.success.fg }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{course.matchScore}% match</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: color.ink }}>{course.title}</div>
              <Badge tone={DIFFICULTY_TONE[course.difficulty]}>{course.difficulty}</Badge>
            </div>
            <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 10 }}>{course.category}</div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, color: color.textFaint, marginBottom: 14 }}>
              <span>{course.videoCount} videos</span>
              <span>·</span>
              <span>{formatDuration(course.durationMinutes)}</span>
            </div>

            <div style={{ width: "100%", padding: "8px 0", textAlign: "center", borderRadius: 8, border: "1px solid #CFCBC0", fontSize: 12.5, fontWeight: 600, color: color.ink, fontFamily: font.body }}>
              Start Learning
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
