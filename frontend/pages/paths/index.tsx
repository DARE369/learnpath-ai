import React, { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import { useAuth } from "../../hooks/useAuth";
import { CATALOG, Difficulty } from "../../utils/catalog";
import { Card } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";
import { useViewport } from "../../ui-v2/useViewport";

const STAGE_MESSAGES = [
  "Searching YouTube for the best videos…",
  "Scoring video quality with AI…",
  "Reading transcripts…",
  "Generating concept summaries…",
  "Mapping prerequisites…",
  "Assembling your learning path…",
];

const DIFFICULTY_FILTERS: { value: "all" | Difficulty; label: string }[] = [
  { value: "all", label: "All" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function authHeaders(json = false): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface HistoryItem { query: string; topic_id: string; video_count: number; average_score: number; available: boolean; last_explored_at: string | null; }
interface ConfirmInfo { query: string; topicId: string | null; fromCache: boolean; exploredBefore: boolean; videoCount: number; }
interface ConceptRow { id: string; display_name: string; }
interface PathRow { id: string; path_name: string; completed_modules: number; total_modules: number; progress_percent: number; }

export default function PathsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState<"explore" | "guided">("explore");

  // ── Explore: search/build ──────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCachedBuild, setIsCachedBuild] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [confirmInfo, setConfirmInfo] = useState<ConfirmInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get<{ history: HistoryItem[] }>("/api/search/history", { params: { limit: 12 }, headers: authHeader });
      setHistory(res.data?.history ?? []);
    } catch { /* non-fatal */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  function openTopic(topicId: string) { router.push(`/learning/${encodeURIComponent(topicId)}/0`); }
  function openPreview(topicId: string, source: "fresh" | "cached") { router.push(`/paths/preview?topic_id=${encodeURIComponent(topicId)}&source=${source}`); }

  function rotateStages() {
    const start = Date.now();
    setStageIndex(0);
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setStageIndex(Math.min(STAGE_MESSAGES.length - 1, Math.floor(elapsed / 7)));
    }, 1500);
    return () => clearInterval(id);
  }

  async function runSearch(rawQuery: string, forceRefresh = false) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) { setBuildError("Please enter a topic (at least 2 characters)."); return; }
    setBuildError(null);
    setConfirmInfo(null);
    setIsCachedBuild(false);
    setLoading(true);
    const stopRotating = rotateStages();
    try {
      const res = await axios.post("/api/search/build-path", { query: trimmed, use_cache: !forceRefresh, force_refresh: forceRefresh }, { headers: authHeader });
      const result = res.data;
      try { sessionStorage.setItem(`builtPath:${result.topic_id}`, JSON.stringify(result)); } catch { /* unavailable */ }
      void loadHistory();
      openPreview(result.topic_id, forceRefresh ? "fresh" : result.source === "cache" ? "cached" : "fresh");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
        if (status === 401) setBuildError("Please sign in to build a learning path.");
        else if (status === 429) {
          const retryAfter = err.response?.headers?.["retry-after"];
          const seconds = retryAfter ? parseInt(retryAfter, 10) : (() => { const m = (detail || "").match(/(\d+)\s*second/i); return m ? parseInt(m[1], 10) : 0; })();
          const timeStr = seconds >= 3600 ? `about ${Math.ceil(seconds / 3600)} hour(s)` : seconds >= 60 ? `about ${Math.ceil(seconds / 60)} minute(s)` : seconds > 0 ? `${seconds} seconds` : "a little while";
          setBuildError(`You've reached your search limit. Try again in ${timeStr}, or upgrade for more searches.`);
        } else if (status === 400) setBuildError(detail || "We couldn't build a path for that topic. Try a more specific search.");
        else if (status === 404) setBuildError("Search endpoint not available yet. The backend may still be deploying — try again in a minute.");
        else if (status === 502 || status === 503 || status === 504) setBuildError("Search service is temporarily unreachable (the backend may be redeploying). Try again in 30 seconds.");
        else setBuildError(detail || "Something went wrong. Please try again.");
      } else {
        setBuildError("Network error. Check your connection.");
      }
    } finally {
      stopRotating();
      setLoading(false);
    }
  }

  async function preflight(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) { setBuildError("Please enter a topic (at least 2 characters)."); return; }
    setBuildError(null);
    try {
      const res = await axios.get("/api/search/lookup", { params: { q: trimmed }, headers: authHeader });
      const d = res.data || {};
      if (d.exists || d.explored_before) {
        setConfirmInfo({ query: trimmed, topicId: d.topic_id ?? null, fromCache: !!d.from_cache, exploredBefore: !!d.explored_before, videoCount: d.video_count ?? 0 });
        return;
      }
    } catch { /* fall through */ }
    await runSearch(trimmed, false);
  }

  function continueExisting() {
    const info = confirmInfo;
    setConfirmInfo(null);
    if (info?.fromCache && info.topicId) openPreview(info.topicId, "cached");
    else if (info) void runSearch(info.query, false);
  }
  function rebuildFresh() { const info = confirmInfo; setConfirmInfo(null); if (info) void runSearch(info.query, true); }

  const autorunFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.q;
    const autorun = router.query.autorun;
    if (typeof q === "string" && q && autorun === "1" && autorunFiredRef.current !== q) {
      autorunFiredRef.current = q;
      setQuery(q);
      (async () => {
        try {
          const res = await axios.get("/api/search/lookup", { params: { q }, headers: authHeader });
          const d = res.data || {};
          if (d.from_cache && d.topic_id) { openTopic(d.topic_id); return; }
          if (d.exists) setIsCachedBuild(true);
        } catch { /* fall through */ }
        void runSearch(q);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query]);

  // ── Explore: catalog ────────────────────────────────────────────────────
  const [catalogQuery, setCatalogQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const filtered = CATALOG.filter((c) => {
    if (difficulty !== "all" && c.difficulty !== difficulty) return false;
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
  });

  // ── Guided tab ───────────────────────────────────────────────────────────
  const [guidedPaths, setGuidedPaths] = useState<PathRow[]>([]);
  const [guidedLoading, setGuidedLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [conceptQuery, setConceptQuery] = useState("");
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<ConceptRow | null>(null);
  const [targetWeeks, setTargetWeeks] = useState(12);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadGuidedPaths = useCallback(async () => {
    try {
      const res = await fetch("/api/adaptive-paths/", { headers: authHeaders() });
      const data = await res.json();
      setGuidedPaths(data.paths || []);
    } catch {
      setGuidedPaths([]);
    } finally {
      setGuidedLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "guided") loadGuidedPaths(); }, [tab, loadGuidedPaths]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!conceptQuery) { setConcepts([]); return; }
      try {
        const res = await fetch(`/api/knowledge/concepts?q=${encodeURIComponent(conceptQuery)}`, { headers: authHeaders() });
        const data = await res.json();
        setConcepts((data.concepts || []).slice(0, 8));
      } catch { setConcepts([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [conceptQuery]);

  async function createGuidedPath() {
    if (!selectedConcept) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/adaptive-paths/", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ goal_concept_id: selectedConcept.id, target_weeks: targetWeeks }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create path");
      router.push(`/paths/${data.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error");
      setCreating(false);
    }
  }

  return (
    <>
      <Head><title>Paths — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1000, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Paths</h1>
          <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 8, padding: 3 }}>
            {(["explore", "guided"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6, cursor: "pointer", border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? color.ink : color.textFaint }}>{t === "explore" ? "Explore" : "Guided"}</button>
            ))}
          </div>
        </div>

        {tab === "explore" ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); preflight(query); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", border: `1px solid ${color.border}`, borderRadius: 8, background: "#fff", marginBottom: 8, maxWidth: 560 }}>
              <span style={{ color: color.textFaint }}>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any topic to build a path…" disabled={loading} style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, fontFamily: font.body, background: "transparent" }} />
              <button type="submit" disabled={loading} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer", flexShrink: 0 }}>{loading ? "Building…" : "Build path"}</button>
            </form>
            {buildError && <div style={{ fontSize: 12.5, color: color.danger.fg, marginBottom: 14, maxWidth: 560 }}>{buildError}</div>}

            {confirmInfo && (
              <Card padding="md" style={{ marginBottom: 20, maxWidth: 460 }}>
                <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>You&rsquo;ve explored &ldquo;{confirmInfo.query}&rdquo; before</div>
                <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 16 }}>
                  {confirmInfo.fromCache ? `A ready-made path${confirmInfo.videoCount ? ` (${confirmInfo.videoCount} videos)` : ""} already exists.` : "Continue where you left off, or rebuild fresh."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={continueExisting} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>Continue — reuse cached path (free)</button>
                  <button onClick={rebuildFresh} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>Rebuild fresh</button>
                  <button onClick={() => setConfirmInfo(null)} style={{ padding: "8px 16px", fontSize: 13, background: "none", border: "none", color: color.textFaint, cursor: "pointer" }}>Cancel</button>
                </div>
              </Card>
            )}

            {history.length > 0 && !loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
                <span style={{ fontSize: 12, color: color.textFaint }}>Recently explored:</span>
                {history.map((h) => (
                  <button key={h.topic_id} onClick={() => openTopic(h.topic_id)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 500, borderRadius: 100, border: `1px solid ${color.border}`, background: "#fff", color: color.inkSoft, cursor: "pointer" }}>{h.query}</button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(20,23,31,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 14, padding: "36px 40px", maxWidth: 420, width: "100%", textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #EFEDE6", borderTopColor: "#2B3A67", margin: "0 auto 20px", animation: "spin 900ms linear infinite" }} />
                  <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 17, marginBottom: 8 }}>Building your path</div>
                  <div style={{ fontSize: 13.5, color: color.inkSoft }}>{isCachedBuild ? "Loading your saved path…" : STAGE_MESSAGES[stageIndex]}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Showcase catalog <span style={{ fontWeight: 400, color: color.textFaint }}>· curated suggestions, builds a fresh path</span></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <input value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Filter catalog…" style={{ padding: "6px 10px", fontSize: 12.5, border: `1px solid ${color.border}`, borderRadius: 6, fontFamily: font.body, outline: "none" }} />
              {DIFFICULTY_FILTERS.map((f) => (
                <button key={f.value} onClick={() => setDifficulty(f.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer", border: `1px solid ${difficulty === f.value ? "#2B3A67" : color.border}`, background: difficulty === f.value ? "#2B3A67" : "#fff", color: difficulty === f.value ? "#fff" : color.inkSoft }}>{f.label}</button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 10, padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 12 }}>No courses match your search.</div>
                <button onClick={() => { setCatalogQuery(""); setDifficulty("all"); }} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Clear filters</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 12 : 16 }}>
                {filtered.map((c) => (
                  <Link key={c.id} href={`/courses/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Card padding="md">
                      <div style={{ fontFamily: font.mono, fontSize: 11, color: color.textFaint, marginBottom: 8 }}>{c.category} · {c.difficulty}</div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8, lineHeight: 1.35 }}>{c.title}</div>
                      <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 10 }}>{c.durationMinutes} min · {c.videoCount} videos</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ color: "#C8792A" }}>★</span> {c.rating.toFixed(1)} <span style={{ color: color.textFaint }}>· {c.studentCount.toLocaleString()} students</span></div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={() => setShowCreate((v) => !v)} style={{ padding: "9px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>Create a path</button>
            </div>

            {showCreate && (
              <Card padding="md" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>New goal-based path</div>
                {selectedConcept ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: color.surfaceMuted, borderRadius: 8, padding: "9px 14px", marginBottom: 12 }}>
                    <span style={{ fontSize: 13 }}>🎯 {selectedConcept.display_name}</span>
                    <button onClick={() => setSelectedConcept(null)} style={{ background: "none", border: "none", color: color.textFaint, fontSize: 12, cursor: "pointer" }}>change</button>
                  </div>
                ) : (
                  <>
                    <input value={conceptQuery} onChange={(e) => setConceptQuery(e.target.value)} placeholder='Search a concept goal, e.g. "Organic chemistry mastery"' style={{ width: "100%", padding: "9px 12px", fontSize: 13.5, border: "1px solid #CFCBC0", borderRadius: 6, marginBottom: 8 }} />
                    {concepts.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {concepts.map((c) => <button key={c.id} onClick={() => setSelectedConcept(c)} style={{ padding: "6px 12px", fontSize: 12.5, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>{c.display_name}</button>)}
                      </div>
                    )}
                    {conceptQuery && concepts.length === 0 && <p style={{ fontSize: 12, color: color.textFaint, marginBottom: 12 }}>No concepts found. An admin can seed the concept graph from /admin first.</p>}
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: color.textFaint }}>Target weeks</label>
                  <input type="number" min={1} max={52} value={targetWeeks} onChange={(e) => setTargetWeeks(Number(e.target.value))} style={{ width: 70, padding: "6px 10px", fontSize: 13, border: "1px solid #CFCBC0", borderRadius: 6 }} />
                </div>
                {createError && <p style={{ fontSize: 12, color: color.danger.fg, marginBottom: 10 }}>{createError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={createGuidedPath} disabled={!selectedConcept || creating} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: "none", cursor: selectedConcept ? "pointer" : "not-allowed", background: selectedConcept ? "#2B3A67" : "#F0EEE7", color: selectedConcept ? "#fff" : color.textFainter }}>{creating ? "Creating…" : "Create path"}</button>
                  <button onClick={() => { setShowCreate(false); setSelectedConcept(null); setConceptQuery(""); }} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", cursor: "pointer" }}>Cancel</button>
                </div>
              </Card>
            )}

            {guidedLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div>
            ) : guidedPaths.length === 0 ? (
              <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 10, padding: 40, textAlign: "center" }}><div style={{ fontSize: 13.5, color: color.inkSoft }}>No paths yet — create one above.</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {guidedPaths.map((p) => (
                  <Link key={p.id} href={`/paths/${p.id}`} style={{ textDecoration: "none" }}>
                    <Card padding="md">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: color.ink }}>{p.path_name}</span>
                        <span style={{ fontSize: 12, color: color.textFaint }}>{p.completed_modules}/{p.total_modules}</span>
                      </div>
                      <div style={{ height: 5, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden" }}><div style={{ height: "100%", width: `${p.progress_percent}%`, background: "#2B3A67", borderRadius: 100 }} /></div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
