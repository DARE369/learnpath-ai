import React from "react";
import { ArrowLeft } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCourse, Difficulty } from "../../utils/catalog";
import BranchSelector from "../../components/Learning/BranchSelector";

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

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-warning" : "text-white/15"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
}

export default function CourseDetailPage() {
  const router = useRouter();
  const { courseId } = router.query;
  const course = getCourse(typeof courseId === "string" ? courseId : undefined);

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">Course not found</h1>
        <p className="text-white/50 mb-6">We couldn&apos;t find a course with that ID.</p>
        <Link href="/explore" className="inline-flex items-center gap-1 text-accent-light hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to explore
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{course.title} — LearnPath AI</title>
        <meta name="description" content={course.description} />
      </Head>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to explore
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wide">
              {course.category}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DIFFICULTY_STYLE[course.difficulty]}`}>
              {course.difficulty}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
            {course.title}
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-3xl">
            {course.longDescription}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {course.videoCount} videos
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
              {formatDuration(course.durationMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {course.studentCount.toLocaleString()} learners
            </span>
            <span className="flex items-center gap-1.5">
              <StarRow rating={course.rating} />
              <span>{course.rating.toFixed(1)} ({course.ratingCount.toLocaleString()})</span>
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="mb-12 p-6 bg-surface-elevated border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-white font-semibold mb-1">Ready to start?</p>
            <p className="text-sm text-white/50">
              Jump straight into the first video — your progress saves automatically.
            </p>
          </div>
          <Link
            // Catalog courses have no real videos — pipe the title through
            // the search pipeline so the user gets curated YouTube videos.
            href={`/explore?q=${encodeURIComponent(course.title)}&autorun=1`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Start learning
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Branches — BranchSelector calls the real branch-path endpoint and
            navigates to /learning itself when no onSelect is provided. */}
        <BranchSelector conceptName={course.title} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Syllabus */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-white mb-4">Syllabus</h2>
            <ol className="space-y-2">
              {course.syllabus.map((lesson, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 p-4 bg-surface-elevated border border-border rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-muted text-accent-light flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
                  </div>
                  <span className="text-xs text-white/40 flex-shrink-0">
                    {formatDuration(lesson.minutes)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {course.prerequisites.length > 0 && (
              <div className="p-5 bg-surface-elevated border border-border rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-3">Prerequisites</h3>
                <ul className="space-y-2 text-sm text-white/55">
                  {course.prerequisites.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-accent-light flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-5 bg-surface-elevated border border-border rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2">Curated by</h3>
              <p className="text-sm text-white/55">{course.instructor}</p>
            </div>
          </aside>
        </div>

        {/* Reviews */}
        {course.reviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-white mb-4">What learners say</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.reviews.map((r, i) => (
                <div key={i} className="p-5 bg-surface-elevated border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">{r.author}</span>
                    <StarRow rating={r.rating} />
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{r.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
