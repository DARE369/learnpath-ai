import React from "react";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  category: string;
  videoCount: number;
  durationMinutes: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  matchScore: number;
  gradient: string;
  icon: string;
}

const difficultyConfig = {
  Beginner: "text-emerald-400 bg-emerald-500/10",
  Intermediate: "text-amber-400 bg-amber-500/10",
  Advanced: "text-rose-400 bg-rose-500/10",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ""}`.trim();
}

export default function RecommendedCourses({ courses }: { courses: Course[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((course) => (
        <Link key={course.id} href={`/learning/${course.id}/0`}>
          <div className="group bg-[#1c1c1c] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-indigo-500/30 hover:bg-[#1f1f1f] transition-all duration-200 cursor-pointer">
            {/* Gradient header */}
            <div
              className="h-32 relative overflow-hidden"
              style={{ background: course.gradient }}
            >
              {/* Pattern overlay */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)",
                }}
              />
              <div className="absolute bottom-3 left-4 text-4xl">{course.icon}</div>

              {/* Match score */}
              <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold text-white">{course.matchScore}% match</span>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">
                  {course.title}
                </h3>
                <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${difficultyConfig[course.difficulty]}`}>
                  {course.difficulty}
                </span>
              </div>
              <p className="text-xs text-white/30 mb-3">{course.category}</p>
              <div className="flex items-center gap-3 text-xs text-white/30">
                <span>{course.videoCount} videos</span>
                <span>·</span>
                <span>{formatDuration(course.durationMinutes)}</span>
              </div>

              <button className="mt-4 w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-400 hover:text-white text-xs font-semibold transition-all duration-200">
                Start Learning
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
