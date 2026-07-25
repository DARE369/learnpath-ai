import React, { useEffect, useState } from "react";
import { Card, ThresholdRing } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

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

// JS-driven pulse (opacity/scale toggle) — ui-v2 has no global stylesheet, so
// this replaces the old @keyframes for the "now playing" indicator bars.
function usePulse(intervalMs = 800): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return on;
}

function VideoStatusBadge({ pct, completed }: { pct?: number; completed?: boolean }) {
  if (completed) {
    return (
      <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "rgba(30,127,92,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#5FCFA0" }}>
        <Icon name="checkCircle" size={14} className="" />
      </div>
    );
  }
  if (pct && pct > 0) {
    return (
      <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "rgba(43,95,168,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6FA0E0" }}>
        <Icon name="play" size={12} className="" />
      </div>
    );
  }
  return (
    <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", border: `1px solid ${color.chromeBorder}`, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
    </div>
  );
}

function NowPlayingBars() {
  const on = usePulse();
  return (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", marginTop: 2 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 2, height: 12, borderRadius: 100, background: "#6FA0E0", opacity: on ? 1 : 0.5, transform: `scaleY(${on ? 1 : 0.4})`, transition: "transform 0.4s ease, opacity 0.4s ease" }} />
        ))}
      </div>
    </div>
  );
}

export default function ProgressTracker({ videos, currentIndex, totalWatchSeconds, onNavigate }: ProgressTrackerProps) {
  const completedCount = videos.filter((v) => v.completed).length;
  const overallPct = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card dark padding="md">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ThresholdRing pct={overallPct} size={56} dark plain />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: color.chromeText }}>Path Progress</div>
            <div style={{ fontSize: 12, color: color.textFainter, marginTop: 2 }}>{completedCount} of {videos.length} videos completed</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: color.textFainter }}>
              <Icon name="clock" size={13} className="" />
              {formatWatchTime(totalWatchSeconds)} watched
            </div>
          </div>
        </div>
      </Card>

      <Card dark padding="sm" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${color.chromeBorder}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: color.textFainter, textTransform: "uppercase", letterSpacing: "0.05em" }}>Videos</div>
        </div>
        <div>
          {videos.map((video, i) => {
            const isActive = video.index === currentIndex;
            const showProgress = (video.watchPercentage ?? 0) > 0 && !video.completed;
            return (
              <button
                key={video.index}
                onClick={() => onNavigate?.(video.index)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left",
                  padding: "12px 16px", border: "none", cursor: "pointer",
                  borderBottom: i < videos.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
                  background: isActive ? "rgba(43,95,168,0.1)" : "transparent",
                  fontFamily: font.body,
                }}
              >
                <div style={{ marginTop: 2 }}>
                  <VideoStatusBadge pct={video.watchPercentage} completed={video.completed} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.4, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isActive ? "#8FB6E8" : color.chromeTextMuted, fontWeight: isActive ? 500 : 400 }}>
                    {video.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {video.durationSeconds && <span style={{ fontSize: 11, color: color.textFainter }}>{formatDuration(video.durationSeconds)}</span>}
                    {showProgress && (
                      <>
                        <span style={{ fontSize: 11, color: color.textFainter }}>·</span>
                        <span style={{ fontSize: 11, color: "#6FA0E0" }}>{video.watchPercentage}% watched</span>
                      </>
                    )}
                  </div>
                  {showProgress && (
                    <div style={{ marginTop: 6, height: 2, borderRadius: 100, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${video.watchPercentage}%`, borderRadius: 100, background: "rgba(43,95,168,0.6)" }} />
                    </div>
                  )}
                </div>

                {isActive && <NowPlayingBars />}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
