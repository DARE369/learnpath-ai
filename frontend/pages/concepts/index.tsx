import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Search } from "lucide-react";
import { color, font } from "../../ui-v2/tokens";

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface ConceptNode { id: string; display_name: string; subject?: string; difficulty: number; }
interface GraphNode { id: string; display_name: string; difficulty: number; }
interface GraphEdge { source: string; target: string; type: string; }

const W = 820, ROW_H = 70, PAD_X = 70;

function masteryFill(difficulty: number): string {
  // No per-concept mastery % is returned by /api/knowledge/concepts today, so the
  // grid's mastery-square coloring falls back to a neutral "not started" fill
  // rather than fabricating a percentage the backend doesn't provide.
  return "#D9D5C9";
}

export default function ConceptsLibrary() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "grid" | "graph">("list");
  const [concepts, setConcepts] = useState<ConceptNode[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge/concepts?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
      const data = await res.json();
      setConcepts(data.concepts || []);
    } catch {
      setConcepts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false);

  useEffect(() => {
    if (view !== "graph" || graphLoaded) return;
    setGraphLoading(true);
    fetch("/api/knowledge/graph", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { nodes: [], edges: [] }))
      .then((d) => { setNodes(d.nodes || []); setEdges(d.edges || []); })
      .catch(() => {})
      .finally(() => { setGraphLoading(false); setGraphLoaded(true); });
  }, [view, graphLoaded]);

  const { pos, H } = useMemo(() => {
    const cols: Record<number, GraphNode[]> = {};
    nodes.forEach((n) => { const d = Math.max(1, Math.min(10, n.difficulty || 5)); (cols[d] = cols[d] || []).push(n); });
    const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const innerW = W - PAD_X * 2;
    const p: Record<string, { x: number; y: number }> = {};
    let maxRows = 1;
    colKeys.forEach((d, ci) => {
      const x = colKeys.length > 1 ? PAD_X + (innerW * ci) / (colKeys.length - 1) : W / 2;
      cols[d].forEach((n, ri) => { p[n.id] = { x, y: 60 + ri * ROW_H }; });
      maxRows = Math.max(maxRows, cols[d].length);
    });
    return { pos: p, H: Math.max(240, 60 + maxRows * ROW_H + 30) };
  }, [nodes]);

  const grouped = useMemo(() => {
    const bySubject: Record<string, ConceptNode[]> = {};
    concepts.forEach((c) => { const s = c.subject || "Other"; (bySubject[s] = bySubject[s] || []).push(c); });
    return Object.entries(bySubject);
  }, [concepts]);

  return (
    <>
      <Head><title>Concepts — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1000, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Concepts</h1>
          <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 8, padding: 3 }}>
            {(["list", "grid", "graph"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 6, cursor: "pointer", border: "none", background: view === v ? "#fff" : "transparent", color: view === v ? color.ink : color.textFaint }}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", border: `1px solid ${color.border}`, borderRadius: 8, background: "#fff", fontSize: 13.5, marginBottom: 20, maxWidth: 420 }}>
          <Search size={15} strokeWidth={1.6} color={color.textFaint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search concepts…" style={{ border: "none", outline: "none", fontSize: 13.5, fontFamily: font.body, width: "100%", background: "transparent", color: color.ink }} />
        </div>

        {view !== "graph" && concepts.length === 0 && !loading ? (
          <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center" }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>No concepts indexed yet</div>
            <div style={{ fontSize: 13.5, color: color.inkSoft, maxWidth: 420, margin: "0 auto" }}>An admin can seed the concept graph from existing content via the knowledge API.</div>
          </div>
        ) : view === "list" ? (
          loading ? <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div> : (
            <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, overflow: "hidden" }}>
              {concepts.map((c) => (
                <Link key={c.id} href={`/concepts/${c.id}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13.5, textDecoration: "none", color: "inherit", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{c.display_name}</div>
                  <div style={{ color: color.inkSoft }}>{c.subject || "—"}</div>
                  <div style={{ fontFamily: font.mono, color: color.textFaint }}>level {c.difficulty}</div>
                </Link>
              ))}
            </div>
          )
        ) : view === "grid" ? (
          <>
            <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 14 }}>Grouped by subject. Click a square to open that concept.</div>
            {grouped.map(([subject, items]) => (
              <div key={subject} style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: color.textFaint, marginBottom: 8 }}>{subject}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {items.map((c) => (
                    <div key={c.id} onClick={() => router.push(`/concepts/${c.id}`)} title={`${c.display_name} · level ${c.difficulty}`} style={{ width: 52, height: 52, borderRadius: 8, background: masteryFill(c.difficulty), display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <span style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 600, color: color.textFaint }}>{c.difficulty}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, background: "#F4F1EA", border: `1px solid ${color.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: color.inkSoft, lineHeight: 1.5 }}>
              This is an optional exploratory view of how concepts connect — everything here is also in List and Grid. Left-to-right is easier to harder.
            </div>
            {graphLoading ? (
              <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
            ) : nodes.length === 0 ? (
              <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center" }}>No concepts yet — an admin can seed the graph from /admin.</div>
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 16, overflowX: "auto" }}>
                <svg width={W} height={H}>
                  {edges.map((e, i) => {
                    const a = pos[e.source]; const b = pos[e.target];
                    if (!a || !b) return null;
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.type === "prerequisite" ? "#C8792A" : "#DEDACF"} strokeWidth={1.5} />;
                  })}
                  {nodes.map((n) => {
                    const p = pos[n.id];
                    if (!p) return null;
                    return (
                      <g key={n.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/concepts/${n.id}`)}>
                        <circle cx={p.x} cy={p.y} r={6 + (n.difficulty || 5) * 1.2} fill="#2B3A67" fillOpacity={0.85} stroke="#8B93AE" strokeWidth={1} />
                        <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize={11} fill={color.ink}>{n.display_name.length > 22 ? n.display_name.slice(0, 21) + "…" : n.display_name}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
