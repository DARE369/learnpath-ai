import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { CATALOG, Difficulty } from "../utils/catalog";

const DIFFICULTY_FILTERS: { value: "all" | Difficulty; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  beginner: "bg-success-muted text-success",
  intermediate: "bg-accent-muted text-accent-light",
  advanced: "bg-error-muted text-error",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((course) => {
      if (difficulty !== "all" && course.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q)
      );
    });
  }, [query, difficulty]);

  return (
    <>
      <Head>
        <title>Explore — LearnPath AI</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
            Explore courses
          </h1>
          <p className="text-white/50">
            Curated learning paths assembled from the best YouTube content, scored and ordered by AI.
          </p>
        </div>

        {/* Search + filter row */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by topic, title, or category…"
              className="input-field pl-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setDifficulty(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  difficulty === f.value
                    ? "bg-accent text-white shadow-glow-sm"
                    : "bg-surface-elevated text-white/60 hover:text-white hover:bg-surface-hover"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <p className="text-sm text-white/40 mb-4">
          {filtered.length} {filtered.length === 1 ? "course" : "courses"}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface-elevated rounded-xl border border-border">
            <p className="text-white/60 mb-2">No courses match your search.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDifficulty("all");
              }}
              className="text-accent-light hover:text-white text-sm"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((course) => (
              <article
                key={course.id}
                className="group bg-surface-elevated border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-accent/30 hover:bg-surface-hover transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wide">
                    {course.category}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DIFFICULTY_STYLE[course.difficulty]}`}
                  >
                    {course.difficulty}
                  </span>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white leading-snug mb-2 group-hover:text-accent-light transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-white/55 leading-relaxed line-clamp-3">
                    {course.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {course.videoCount} videos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path strokeLinecap="round" d="M12 6v6l4 2" />
                    </svg>
                    {formatDuration(course.durationMinutes)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-warning" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                    {course.rating.toFixed(1)}
                  </span>
                </div>

                <Link
                  href={`/courses/${course.id}`}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
                >
                  Start course
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
