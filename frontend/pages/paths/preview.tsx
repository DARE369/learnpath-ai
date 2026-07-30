import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Card } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";
import { useViewport } from "../../ui-v2/useViewport";

interface PathVideo { video_id: string; youtube_id: string; title: string; duration_minutes: number; eqs_score: number; summary: string; concepts: string[]; thumbnail_url: string; }
interface PathStats { videos_found: number; videos_used: number; average_quality_score: number; confidence: string; concepts_covered: number; }
interface BuiltPath { topic_id: string; topic_name: string; learning_path: PathVideo[]; stats: PathStats; time_to_build_seconds: number; source: string; }

function qualityLabel(q: number): string {
  if (q >= 90) return "Outstanding";
  if (q >= 80) return "Excellent";
  return "Good";
}
function qualityColor(q: number): { bg: string; fg: string } {
  if (q >= 90) return { bg: color.success.bg, fg: color.success.fg };
  if (q >= 80) return { bg: color.info.bg, fg: color.info.fg };
  return { bg: color.warning.bg, fg: color.warning.fg };
}

/**
 * The "review before you commit" screen the design bundle inserts between a
 * finished build and video 1. Reads the same `builtPath:{topic_id}`
 * sessionStorage handoff the search/branch flows already write.
 *
 * Note: the design mock also showed a per-video "Swap for an alternate"
 * action and a "Save for later" action — neither has a real backend
 * endpoint today (no alternates search, no "save without starting" state
 * for ad-hoc paths), so both are intentionally left out rather than faked.
 */
export default function PathPreview() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const topicId = typeof router.query.topic_id === "string" ? router.query.topic_id : "";
  const source = router.query.source === "cached" ? "cached" : "fresh";
  const [result, setResult] = useState<BuiltPath | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!topicId) return;
    try {
      const raw = sessionStorage.getItem(`builtPath:${topicId}`);
      if (raw) { setResult(JSON.parse(raw)); return; }
    } catch { /* ignore */ }
    setNotFound(true);
  }, [topicId]);

  function startLearning() {
    router.push(`/learning/${encodeURIComponent(topicId)}/0`);
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 700, fontFamily: font.body }}>
        <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "60px 30px", textAlign: "center", marginTop: 20 }}>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19, marginBottom: 10 }}>Path not found</div>
          <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 22 }}>This preview could not be loaded. It may have expired — search again to rebuild it.</div>
          <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Back to Paths</Link>
        </div>
      </div>
    );
  }
  if (!result) return null;

  return (
    <>
      <Head><title>{result.topic_name} — Preview — LearnPath AI</title></Head>
      <div style={{ maxWidth: 780, fontFamily: font.body }}>
        <Link href="/paths" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textFaint, textDecoration: "none" }}>← Search a different topic</Link>

        <div style={{ margin: "16px 0 6px" }}>
          <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 100, background: source === "cached" ? color.info.bg : color.success.bg, color: source === "cached" ? color.info.fg : color.success.fg }}>
            {source === "cached" ? "REUSED FROM CACHE · FREE" : "BUILT FRESH JUST NOW"}
          </span>
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 27, margin: "0 0 8px" }}>Your path on &ldquo;{result.topic_name}&rdquo; is ready</h1>
        <p style={{ fontSize: 13.5, color: color.inkSoft, margin: "0 0 24px", maxWidth: 600, lineHeight: 1.55 }}>{result.learning_path.length} videos, sequenced by prerequisite — not upload date. Review the order below, then start whenever you&rsquo;re ready.</p>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{result.stats.videos_used}</div><div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>Videos in this path</div></Card>
          <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{result.learning_path.reduce((s, v) => s + (v.duration_minutes || 0), 0)} min</div><div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>Total watch time</div></Card>
          <Card padding="md"><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600, color: color.success.fg }}>{Math.round(result.stats.average_quality_score)}%</div><div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>Average quality score</div></Card>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Watch order</div>
        <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, marginBottom: 28 }}>
          {result.learning_path.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13.5, color: color.textFaint, textAlign: "center" }}>Path built, but no videos passed the quality filter for this query. Try a more common topic.</div>
          ) : result.learning_path.map((v, i) => {
            const q = qualityColor(v.eqs_score);
            return (
              <div key={v.video_id || v.youtube_id || i} style={{ padding: "16px 18px", borderBottom: i < result.learning_path.length - 1 ? `1px solid ${color.borderMuted}` : "none", display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: color.surfaceElevated, color: color.inkSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600, flexShrink: 0, fontFamily: font.mono }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{v.title || "Untitled video"}</div>
                    {v.eqs_score > 0 && <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 100, background: q.bg, color: q.fg, flexShrink: 0 }}>{Math.round(v.eqs_score)}% · {qualityLabel(v.eqs_score)}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: color.textFaint, margin: "2px 0 0" }}>{v.duration_minutes > 0 ? `${v.duration_minutes} min` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={startLearning} disabled={result.learning_path.length === 0} style={{ padding: "12px 24px", fontSize: 14.5, fontWeight: 600, borderRadius: 7, border: "none", background: result.learning_path.length === 0 ? "#B7BDD1" : "#2B3A67", color: "#fff", cursor: result.learning_path.length === 0 ? "not-allowed" : "pointer" }}>Start learning</button>
      </div>
    </>
  );
}
