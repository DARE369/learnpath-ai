import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { config } from "../../env.config";
import { color, font } from "../../ui-v2/tokens";

export interface Branch {
  branch_id: string;
  concept_name: string;
  branch_title: string;
  description: string;
  difficulty_level: number;
  prerequisites: string[];
  estimated_duration_minutes: number;
  branch_order: number;
}

interface BranchSelectorProps {
  conceptName: string;
  onSelect?: (branch: Branch) => void;
}

interface BranchesResponse {
  concept_name: string;
  branches: Branch[];
  source: "cache" | "generated";
  cost_remaining_ngn: number;
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Foundational", 2: "Easy", 3: "Moderate", 4: "Advanced", 5: "Expert" };

function DifficultyDots({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= level ? "#2B3A67" : color.surfaceElevated }} />)}
    </div>
  );
}

export default function BranchSelector({ conceptName, onSelect }: BranchSelectorProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"cache" | "generated" | null>(null);
  const [busyBranch, setBusyBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!conceptName) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `${config.apiUrl}/api/branching/${encodeURIComponent(conceptName)}`;
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 429) throw new Error("Daily branch-generation budget exhausted — try again tomorrow.");
          throw new Error(`Failed to load branches (${res.status})`);
        }
        const data: BranchesResponse = await res.json();
        if (!cancelled) { setBranches(data.branches); setSource(data.source); }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load branches");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [conceptName]);

  if (loading) return <div style={{ padding: 24, background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16 }}><p style={{ fontSize: 13.5, color: color.textFaint, margin: 0 }}>Generating learning branches for {conceptName}…</p></div>;
  if (error) return <div style={{ padding: 24, background: "#fff", border: `1px solid #E7B7AE`, borderRadius: 16 }}><p style={{ fontSize: 13.5, color: color.danger.fg, margin: 0 }}>{error}</p></div>;
  if (branches.length === 0) return null;

  async function startBranch(branch: Branch) {
    if (onSelect) { onSelect(branch); return; }
    setBusyBranch(branch.branch_id);
    setError(null);
    try {
      const url = `${config.apiUrl}/api/branching/${encodeURIComponent(branch.concept_name)}/branches/${encodeURIComponent(branch.branch_id)}/learning-path`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        if (res.status === 503) throw new Error("Search pipeline isn't ready yet — try again in a minute.");
        throw new Error(`Couldn't build that branch (${res.status}).`);
      }
      const data = await res.json();
      const path = data?.path;
      if (!path?.topic_id) throw new Error("Branch path missing topic_id — backend returned no usable path.");
      const stash = {
        topic_id: path.topic_id,
        topic_name: `${branch.concept_name} — ${branch.branch_title}`,
        learning_path: path.videos || [],
        stats: { videos_found: path.videos_considered || (path.videos || []).length, videos_used: (path.videos || []).length, average_quality_score: path.average_score || 0, confidence: "branch", concepts_covered: 0 },
        time_to_build_seconds: data.generation_time_seconds || 0,
        source: data.source || "branch",
      };
      try { sessionStorage.setItem(`builtPath:${path.topic_id}`, JSON.stringify(stash)); } catch { /* unavailable */ }
      router.push(`/paths/preview?topic_id=${encodeURIComponent(path.topic_id)}&source=fresh`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to build branch path");
    } finally {
      setBusyBranch(null);
    }
  }

  return (
    <section style={{ marginBottom: 40, fontFamily: font.body }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft }}>Choose your difficulty</div>
        {source === "cache" && <span style={{ fontSize: 11.5, color: color.textFainter }}>cached</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {branches.map((branch) => (
          <div key={branch.branch_id} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{branch.branch_title}</div>
              <div style={{ fontSize: 11.5, color: color.textFaint }}>~{branch.estimated_duration_minutes} min</div>
            </div>
            <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 10 }}>{branch.description}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DifficultyDots level={branch.difficulty_level} />
                <span style={{ fontSize: 11.5, color: color.textFaint }}>{DIFFICULTY_LABEL[branch.difficulty_level] || "—"}</span>
              </div>
              <button onClick={() => startBranch(branch)} disabled={busyBranch === branch.branch_id} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>{busyBranch === branch.branch_id ? "Building…" : "Start this branch"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
