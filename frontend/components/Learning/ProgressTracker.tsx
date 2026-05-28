import React from "react";

interface VideoEntry {
  index: number;
  title: string;
  youtubeId: string;
  durationSeconds?: number;
  watchPercentage?: number;
  completed?: boolean;
}

interface ProgressTrackerProps {
  videos: VideoEntry[];
  currentIndex: number;
  totalWatchSeconds: number;
  onNavigate?: (index: number) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function CircularProgress({ percentage, size = 48 }: { percentage: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#6366f1"
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function VideoStatusBadge({ pct, completed }: { pct?: number; completed?: boolean }) {
  if (completed) {
    return (
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (pct && pct > 0) {
    return (
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-6 h-6 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
    </div>
  );
}

export default function ProgressTracker({
  videos,
  currentIndex,
  totalWatchSeconds,
  onNavigate,
}: ProgressTrackerProps) {
  const completedCount = videos.filter((v) => v.completed).length;
  const overallPct = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Overall progress */}
      <div className="bg-[#1c1c1c] rounded-2xl p-4 border border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <CircularProgress percentage={overallPct} size={56} />
            <span className="absolute text-sm font-semibold text-white tabular-nums">
              {overallPct}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">Path Progress</p>
            <p className="text-white/40 text-xs mt-0.5">
              {completedCount} of {videos.length} videos completed
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                </svg>
                {formatWatchTime(totalWatchSeconds)} watched
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video list */}
      <div className="bg-[#1c1c1c] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Videos</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {videos.map((video) => {
            const isActive = video.index === currentIndex;
            return (
              <button
                key={video.index}
                onClick={() => onNavigate?.(video.index)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                {/* Status badge */}
                <div className="mt-0.5">
                  <VideoStatusBadge pct={video.watchPercentage} completed={video.completed} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-snug truncate ${
                      isActive ? "text-indigo-300 font-medium" : "text-white/70"
                    }`}
                  >
                    {video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {video.durationSeconds && (
                      <span className="text-xs text-white/30">
                        {formatDuration(video.durationSeconds)}
                      </span>
                    )}
                    {(video.watchPercentage ?? 0) > 0 && !video.completed && (
                      <>
                        <span className="text-white/20 text-xs">·</span>
                        <span className="text-xs text-indigo-400/70">
                          {video.watchPercentage}% watched
                        </span>
                      </>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  {(video.watchPercentage ?? 0) > 0 && !video.completed && (
                    <div className="mt-1.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/60 rounded-full transition-all duration-500"
                        style={{ width: `${video.watchPercentage}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="flex-shrink-0 flex items-center mt-0.5">
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-0.5 rounded-full bg-indigo-400"
                          style={{
                            height: 12,
                            animationDelay: `${i * 0.15}s`,
                            animation: "pulse-bar 0.8s ease-in-out infinite alternate",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-bar {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
