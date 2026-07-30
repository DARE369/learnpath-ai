import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCourse } from "../../utils/catalog";
import BranchSelector from "../../components/Learning/BranchSelector";
import { color, font } from "../../ui-v2/tokens";
import { useViewport } from "../../ui-v2/useViewport";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Stars({ rating }: { rating: number }) {
  return <span style={{ color: "#C8792A" }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</span>;
}

export default function CourseDetailPage() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const { courseId } = router.query;
  const course = getCourse(typeof courseId === "string" ? courseId : undefined);

  if (!course) {
    return (
      <div style={{ maxWidth: 700, fontFamily: font.body }}>
        <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "60px 30px", textAlign: "center", marginTop: 20 }}>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19, marginBottom: 10 }}>Course not found</div>
          <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 22 }}>We couldn&rsquo;t find a course with that ID.</div>
          <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Back to Explore</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>{course.title} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 940, fontFamily: font.body }}>
        <Link href="/paths" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textFaint, textDecoration: "none" }}>← Back to Paths</Link>

        <div style={{ fontFamily: font.mono, fontSize: 11, color: color.textFaint, margin: "14px 0 6px", textTransform: "uppercase" }}>{course.category} · {course.difficulty}</div>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 30, margin: "0 0 10px" }}>{course.title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: color.inkSoft, marginBottom: 20, flexWrap: "wrap" }}>
          <span><Stars rating={course.rating} /> {course.rating.toFixed(1)} ({course.ratingCount.toLocaleString()} ratings)</span>
          <span>{course.studentCount.toLocaleString()} students</span>
          <span>{formatDuration(course.durationMinutes)} · {course.videoCount} videos</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <Link href={`/paths?q=${encodeURIComponent(course.title)}&autorun=1`} style={{ padding: "11px 22px", fontSize: 14, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Start learning</Link>
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#3A3F4D", maxWidth: 680, margin: "0 0 28px" }}>{course.longDescription}</p>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: isMobile ? 16 : 24, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Syllabus</div>
            <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10 }}>
              {course.syllabus.map((lesson, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < course.syllabus.length - 1 ? `1px solid ${color.borderMuted}` : "none", fontSize: 13.5 }}>
                  <span style={{ width: 20, fontFamily: font.mono, color: color.textFaint, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{lesson.title}</span>
                  <span style={{ fontSize: 12, color: color.textFaint, flexShrink: 0 }}>{lesson.minutes} min</span>
                </div>
              ))}
            </div>

            {course.prerequisites.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, margin: "22px 0 12px" }}>Prerequisites</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {course.prerequisites.map((p, i) => <span key={i} style={{ fontSize: 12.5, padding: "5px 12px", borderRadius: 100, background: color.surfaceElevated, color: color.inkSoft }}>{p}</span>)}
                </div>
              </>
            )}
          </div>

          <div>
            <BranchSelector conceptName={course.title} />
          </div>
        </div>

        {course.reviews.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Reviews</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {course.reviews.map((r, i) => (
                <div key={i} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.author}</div>
                    <Stars rating={r.rating} />
                  </div>
                  <div style={{ fontSize: 13, color: color.inkSoft, lineHeight: 1.5 }}>{r.comment}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
