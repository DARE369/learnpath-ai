import React from "react";
import Link from "next/link";

interface ActivityItem {
  id: string;
  type: "video_watched" | "course_started" | "achievement" | "concept_mastered";
  title: string;
  subtitle?: string;
  timestamp: string;
  pathId?: string;
  videoIndex?: number;
  icon?: string;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const typeConfig = {
  video_watched: {
    dot: "bg-blue-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    ),
    color: "text-blue-400",
  },
  course_started: {
    dot: "bg-indigo-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: "text-indigo-400",
  },
  achievement: {
    dot: "bg-amber-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    color: "text-amber-400",
  },
  concept_mastered: {
    dot: "bg-emerald-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: "text-emerald-400",
  },
};

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
          <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-white/30">No activity yet. Start a course!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const cfg = typeConfig[item.type];
        const isLast = i === items.length - 1;

        return (
          <div key={item.id} className="relative flex gap-3 group">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[9px] top-6 bottom-0 w-px bg-white/[0.06]" />
            )}

            {/* Dot */}
            <div className={`relative flex-shrink-0 w-[18px] h-[18px] mt-0.5 rounded-full border-2 border-[#141414] flex items-center justify-center ${cfg.dot} ${cfg.color}`}>
              <div className="w-2 h-2 text-[8px]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              {item.pathId !== undefined ? (
                <Link
                  href={`/learning/${item.pathId}/${item.videoIndex ?? 0}`}
                  className="block hover:bg-white/[0.03] rounded-xl p-2 -mx-2 transition-colors"
                >
                  <p className="text-sm text-white/70 leading-snug group-hover:text-white/90 transition-colors">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-xs text-white/30 mt-0.5">{item.subtitle}</p>
                  )}
                  <p className="text-xs text-white/20 mt-1">{timeAgo(item.timestamp)}</p>
                </Link>
              ) : (
                <div className="p-2 -mx-2">
                  <p className="text-sm text-white/70 leading-snug">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-xs text-white/30 mt-0.5">{item.subtitle}</p>
                  )}
                  <p className="text-xs text-white/20 mt-1">{timeAgo(item.timestamp)}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
