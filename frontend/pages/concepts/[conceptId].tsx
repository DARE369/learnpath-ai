import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Check, AlertTriangle, Compass } from "lucide-react";
import { color, font } from "../../ui-v2/tokens";
import { ThresholdRing } from "../../ui-v2/primitives";

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface Prereq { id: string; display_name: string; difficulty: number; required_mastery: number; user_mastery: number | null; is_met: boolean; }
interface Detail {
  concept: { id: string; display_name: string; difficulty: number; subject?: string };
  prerequisites: { prerequisites: Prereq[]; all_prerequisites_met: boolean };
  gaps: { gaps: any[]; total_learning_hours: number; ready_to_learn: boolean };
  related: { id: string; display_name: string; relationship: string }[];
  resources: { quiz_questions: number };
}

export default function ConceptDetail() {
  const router = useRouter();
  const conceptId = typeof router.query.conceptId === "string" ? router.query.conceptId : "";
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingPath, setBuildingPath] = useState(false);

  const buildPath = async () => {
    if (!d) return;
    setBuildingPath(true);
    try {
      const res = await fetch("/api/adaptive-paths/", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ goal_concept_id: d.concept.id, target_weeks: 8 }),
      });
      const data = await res.json();
      if (res.ok && data.id) { router.push(`/paths/${data.id}`); return; }
    } catch { /* ignore */ }
    setBuildingPath(false);
  };

  useEffect(() => {
    if (!conceptId) return;
    fetch(`/api/knowledge/concepts/${conceptId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [conceptId]);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><div style={{ width: 32, height: 32, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>;
  }
  if (!d) {
    return (
      <div style={{ maxWidth: 880, textAlign: "center", padding: "56px 30px", background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, marginTop: 20 }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>Concept not found</div>
        <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 20 }}>We couldn&rsquo;t find a concept with that ID.</div>
        <Link href="/concepts" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Back to Concepts</Link>
      </div>
    );
  }

  const prereqs = d.prerequisites.prerequisites;
  const gapCount = d.gaps.gaps.length;
  const ready = d.gaps.ready_to_learn;

  return (
    <>
      <Head><title>{d.concept.display_name} — LearnPath AI</title></Head>
      <div style={{ maxWidth: 880, fontFamily: font.body }}>
        <Link href="/concepts" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: color.textFaint, textDecoration: "none" }}><ArrowLeft size={14} /> All concepts</Link>

        <div style={{ margin: "16px 0 8px" }}>
          <span style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: color.textFaint }}>
            {d.concept.subject || "General"} · level {d.concept.difficulty}
          </span>
        </div>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: "0 0 18px" }}>{d.concept.display_name}</h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 220px)", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <ThresholdRing pct={prereqs.length ? Math.round(prereqs.reduce((s, p) => s + (p.user_mastery ?? 0), 0) / prereqs.length) : 100} size={52} />
            <div>
              <div style={{ fontSize: 12, color: color.textFaint }}>Your mastery</div>
            </div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontFamily: font.mono, fontSize: 24, fontWeight: 600 }}>{ready ? "0h" : `~${d.gaps.total_learning_hours}h`}</div>
            <div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>Estimated hours to ready</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 8, fontWeight: 500, background: ready ? color.success.bg : color.warning.bg, color: ready ? color.success.fg : color.warning.fg, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {ready ? <Check size={16} /> : <AlertTriangle size={16} />}
            {ready ? "You're ready to learn this." : `Fill ${gapCount} prerequisite gap${gapCount === 1 ? "" : "s"} first${d.gaps.total_learning_hours > 0 ? ` (~${d.gaps.total_learning_hours}h)` : ""}.`}
          </span>
          <button onClick={buildPath} disabled={buildingPath} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Compass size={15} /> {buildingPath ? "Building…" : "Build a learning path"}
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, margin: "26px 0 12px" }}>Prerequisites</div>
        {prereqs.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px 18px", fontSize: 13, color: color.textFaint }}>No prerequisites — a great place to start.</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10 }}>
            {prereqs.map((p) => (
              <Link key={p.id} href={`/concepts/${p.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${color.borderMuted}`, textDecoration: "none", color: "inherit" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.display_name}</div>
                  <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>
                    Requires {p.required_mastery}% mastery · you&rsquo;re at <span style={{ color: p.is_met ? color.success.fg : color.warning.fg, fontWeight: 600 }}>{p.user_mastery ?? 0}%</span>
                  </div>
                </div>
                <span style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 100, flexShrink: 0, background: p.is_met ? color.success.bg : color.warning.bg, color: p.is_met ? color.success.fg : color.warning.fg }}>
                  {p.is_met ? "Met" : "Gap"}
                </span>
              </Link>
            ))}
          </div>
        )}

        {d.related.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, margin: "26px 0 12px" }}>Related concepts</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {d.related.map((r) => (
                <Link key={r.id} href={`/concepts/${r.id}`} style={{ textDecoration: "none", color: color.ink, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 500 }}>
                  {r.display_name} <span style={{ color: color.textFaint, fontWeight: 400 }}>· {r.relationship}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
