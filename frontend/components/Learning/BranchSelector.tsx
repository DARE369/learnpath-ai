import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { config } from "../../env.config";

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

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Foundational",
  2: "Easy",
  3: "Moderate",
  4: "Advanced",
  5: "Expert",
};

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level ? "bg-indigo-400" : "bg-white/10"
          }`}
          aria-hidden
        />
      ))}
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
          if (res.status === 429) {
            throw new Error("Daily branch-generation budget exhausted — try again tomorrow.");
          }
          throw new Error(`Failed to load branches (${res.status})`);
        }
        const data: BranchesResponse = await res.json();
        if (!cancelled) {
          setBranches(data.branches);
          setSource(data.source);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load branches");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [conceptName]);

  if (loading) {
    return (
      <div className="p-6 bg-surface-elevated border border-border rounded-2xl">
        <p className="text-sm text-white/50">Generating learning branches for {conceptName}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-surface-elevated border border-error/30 rounded-2xl">
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (branches.length === 0) {
    return null;
  }

  async function startBranch(branch: Branch) {
    // If the parent gave us an onSelect handler, defer to it — keeps the
    // component flexible. Otherwise call the real endpoint, stash the path,
    // and route to /learning ourselves.
    if (onSelect) {
      onSelect(branch);
      return;
    }
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
      if (!path?.topic_id) {
        throw new Error("Branch path missing topic_id — backend returned no usable path.");
      }
      // Stash the result so the learning page renders instantly.
      // The learning page expects a `learning_path` array on the stashed
      // BuiltPath, which path.videos already provides.
      const stash = {
        topic_id: path.topic_id,
        topic_name: `${branch.concept_name} — ${branch.branch_title}`,
        learning_path: path.videos || [],
        stats: {
          videos_found: path.videos_considered || (path.videos || []).length,
          videos_used: (path.videos || []).length,
          average_quality_score: path.average_score || 0,
          confidence: "branch",
          concepts_covered: 0,
        },
        time_to_build_seconds: data.generation_time_seconds || 0,
        source: data.source || "branch",
      };
      try {
        sessionStorage.setItem(`builtPath:${path.topic_id}`, JSON.stringify(stash));
      } catch { /* sessionStorage unavailable — page will fetch instead */ }
      router.push(`/learning/${encodeURIComponent(path.topic_id)}/0`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to build branch path");
    } finally {
      setBusyBranch(null);
    }
  }

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Choose a branch</h2>
        {source === "cache" && (
          <span className="text-xs text-white/30">cached</span>
        )}
      </div>
      <p className="text-sm text-white/50 mb-5 max-w-2xl">
        We split <span className="text-white">{conceptName}</span> into progressive
        branches — pick the one that matches where you are.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => (
          <article
            key={branch.branch_id}
            className="p-5 bg-surface-elevated border border-border rounded-2xl flex flex-col hover:border-accent-light/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wide">
                Branch {branch.branch_order + 1}
              </span>
              <DifficultyDots level={branch.difficulty_level} />
            </div>

            <h3 className="text-base font-semibold text-white mb-2">
              {branch.branch_title}
            </h3>
            <p className="text-sm text-white/55 leading-relaxed mb-4 flex-1">
              {branch.description}
            </p>

            <div className="flex items-center justify-between text-xs text-white/40 mb-4">
              <span>{DIFFICULTY_LABEL[branch.difficulty_level] || "—"}</span>
              <span>~{branch.estimated_duration_minutes} min</span>
            </div>

            {branch.prerequisites.length > 0 && (
              <div className="mb-4 text-xs text-white/40">
                <span className="text-white/30">Prereqs: </span>
                {branch.prerequisites.join(", ")}
              </div>
            )}

            <button
              type="button"
              disabled={busyBranch === branch.branch_id}
              onClick={() => startBranch(branch)}
              className="mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent-muted text-accent-light text-sm font-medium hover:bg-accent-muted/80 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {busyBranch === branch.branch_id ? "Building…" : "Learn this branch"}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
