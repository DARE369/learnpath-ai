import React from "react";
import Link from "next/link";
import type { ActivityItem } from "../../hooks/useDashboardData";
import { Icon, type IconName } from "../../ui-v2/icons";
import { color } from "../../ui-v2/tokens";

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

const TYPE_CONFIG: Record<ActivityItem["type"], { icon: IconName; color: string }> = {
  video_watched: { icon: "play", color: "#2B5FA8" },
  course_started: { icon: "book", color: "#2B3A67" },
  achievement: { icon: "trophy", color: color.warning.fg },
  concept_mastered: { icon: "checkCircle", color: color.success.fg },
  answered: { icon: "chat", color: "#7C5CBF" },
};

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 20px" }}>
        <p style={{ fontSize: 13.5, color: color.textFaint, margin: 0 }}>No activity yet. Start a course!</p>
      </div>
    );
  }

  return (
    <div>
      {items.map((item, i) => {
        const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.video_watched;
        const isLast = i === items.length - 1;
        const body = (
          <>
            <p style={{ fontSize: 13.5, color: color.ink, lineHeight: 1.4, margin: 0 }}>{item.title}</p>
            {item.subtitle && <p style={{ fontSize: 12, color: color.textFaint, margin: "2px 0 0" }}>{item.subtitle}</p>}
            <p style={{ fontSize: 11.5, color: color.textFainter, margin: "4px 0 0" }}>{timeAgo(item.timestamp)}</p>
          </>
        );
        return (
          <div key={item.id} style={{ position: "relative", display: "flex", gap: 12 }}>
            {!isLast && <div style={{ position: "absolute", left: 9, top: 24, bottom: 0, width: 1, background: color.borderMuted }} />}
            <div style={{ position: "relative", flexShrink: 0, width: 18, height: 18, marginTop: 2, borderRadius: "50%", border: `2px solid ${color.surface}`, background: color.surfaceElevated, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color }}>
              <Icon name={cfg.icon} size={10} />
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
              {item.pathId !== undefined ? (
                <Link href={`/learning/${item.pathId}/${item.videoIndex ?? 0}`} style={{ textDecoration: "none", display: "block" }}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
