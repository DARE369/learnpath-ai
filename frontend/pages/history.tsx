import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useProgress } from "../hooks/useProgress";
import { color, font } from "../ui-v2/tokens";
import { useViewport } from "../ui-v2/useViewport";
import { Card, Badge, type BadgeTone } from "../ui-v2/primitives";
import { Icon } from "../ui-v2/icons";
import ActivityHeatmap from "../components/Dashboard/ActivityHeatmap";

function authHeaders(): Record<string, string> {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const PAGE_SIZE = 20;

interface ActivityItem { id: string; type: "video_watched" | "course_started" | "achievement" | "concept_mastered" | "answered"; title: string; subtitle?: string; timestamp: string; pathId?: string; videoIndex?: number; }
const ACTIVITY_TYPE_MAP: Record<string, ActivityItem["type"]> = {
  video_watched: "video_watched", completed: "video_watched", course_started: "course_started", started: "course_started",
  achievement: "achievement", badge: "achievement", concept_mastered: "concept_mastered", mastered: "concept_mastered",
  answered: "answered", quiz_answered: "answered", question_answered: "answered",
};
function mapActivity(raw: any): ActivityItem {
  return {
    id: String(raw.id ?? Math.random()),
    type: ACTIVITY_TYPE_MAP[String(raw.type ?? "")] ?? "video_watched",
    title: String(raw.title ?? ""),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    pathId: raw.pathId ? String(raw.pathId) : raw.path_id ? String(raw.path_id) : undefined,
    videoIndex: raw.videoIndex !== undefined ? Number(raw.videoIndex) : raw.video_index !== undefined ? Number(raw.video_index) : undefined,
  };
}
function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Achievement { id: string; name: string; description: string; icon: string; unlockedAt?: string; progress?: number; rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary"; }
const RARITY_STYLE: Record<string, { bg: string; fg: string }> = {
  common: { bg: color.surfaceElevated, fg: color.textFaint },
  uncommon: { bg: color.info.bg, fg: color.info.fg },
  rare: { bg: color.info.bg, fg: color.info.fg },
  epic: { bg: "#F4EBF5", fg: "#7A4C96" },
  legendary: { bg: color.warning.bg, fg: color.warning.fg },
};

interface Skill { name: string; score: number; trend: string }
interface Milestone { title: string; days_away: number | null; status: string }

export default function HistoryPage() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const { heatmap } = useProgress();
  const initialTab = router.query.tab === "achievements" ? "achievements" : router.query.tab === "skills" ? "skills" : "activity";
  const [tab, setTab] = useState<"activity" | "achievements" | "skills">(initialTab);

  // Skills & milestones
  const [skills, setSkills] = useState<Skill[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(false);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true); setSkillsError(false);
    try {
      const res = await fetch("/api/dashboard/", { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSkills(d.performance?.skills ?? []);
      setMilestones(d.milestones?.milestones ?? []);
    } catch {
      setSkillsError(true);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // Activity
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading] = useState(true);
  const [actError, setActError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (pageOffset: number, replace: boolean) => {
    if (replace) { setActLoading(true); setActError(false); } else { setLoadingMore(true); }
    try {
      const res = await fetch(`/api/dashboard/activity?limit=${PAGE_SIZE}&offset=${pageOffset}`, { headers: authHeaders() });
      const data = await res.json();
      const fetched = (data.activities || []).map(mapActivity);
      setItems((prev) => (replace ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === PAGE_SIZE);
      setOffset(pageOffset + PAGE_SIZE);
    } catch {
      if (replace) setActError(true);
    } finally {
      setActLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadPage(0, true); }, [loadPage]);

  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achLoading, setAchLoading] = useState(true);
  const [achError, setAchError] = useState(false);

  const loadAchievements = useCallback(async () => {
    setAchLoading(true); setAchError(false);
    try {
      const res = await fetch("/api/achievements/", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const all: Achievement[] = data.achievements || [];
        setAchievements([...all.filter((a) => a.unlockedAt), ...all.filter((a) => !a.unlockedAt)]);
      } else {
        const res2 = await fetch("/api/dashboard/", { headers: authHeaders() });
        const d = await res2.json();
        const unlocked = (d.achievements?.unlocked || []).map((a: Achievement) => ({ ...a, unlockedAt: "unlocked" }));
        const locked = d.achievements?.locked || [];
        setAchievements([...unlocked, ...locked]);
      }
    } catch {
      setAchError(true);
    } finally {
      setAchLoading(false);
    }
  }, []);

  useEffect(() => { loadAchievements(); }, [loadAchievements]);

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <>
      <Head><title>History — LearnPath AI</title></Head>
      <div style={{ maxWidth: 900, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>History</h1>
          <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 8, padding: 3 }}>
            {(["activity", "skills", "achievements"] as const).map((t) => (
              <button key={t} onClick={() => { setTab(t); router.replace({ pathname: "/history", query: { tab: t } }, undefined, { shallow: true }); }} style={{ fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6, cursor: "pointer", border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? color.ink : color.textFaint }}>
                {t === "activity" ? "Activity" : t === "skills" ? "Skills" : "Achievements"}
              </button>
            ))}
          </div>
        </div>

        {tab === "activity" && <ActivityHeatmap data={heatmap} />}

        {tab === "activity" ? (
          actError ? (
            <Card padding="md" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 14 }}>Failed to load data</p>
              <button onClick={() => loadPage(0, true)} style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>Retry</button>
            </Card>
          ) : actLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center" }}>
              <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>No activity yet</div>
              <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 18 }}>Start learning to see your history here.</div>
              <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Explore courses</Link>
            </div>
          ) : (
            <>
              <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10 }}>
                {items.map((a, i) => {
                  const inner = (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < items.length - 1 ? `1px solid ${color.borderMuted}` : "none", fontSize: 13 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{a.title}</span>
                      <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.textFaint, flexShrink: 0 }}>{timeAgo(a.timestamp)}</span>
                    </div>
                  );
                  return a.pathId ? (
                    <Link key={a.id} href={`/learning/${a.pathId}/${a.videoIndex ?? 0}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{inner}</Link>
                  ) : (
                    <div key={a.id}>{inner}</div>
                  );
                })}
              </div>
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button onClick={() => loadPage(offset, false)} disabled={loadingMore} style={{ padding: "9px 20px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>{loadingMore ? "Loading…" : "Load more"}</button>
                </div>
              )}
            </>
          )
        ) : tab === "skills" ? (
          skillsError ? (
            <Card padding="md" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 14 }}>Failed to load skills</p>
              <button onClick={loadSkills} style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>Retry</button>
            </Card>
          ) : skillsLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div>
          ) : skills.length === 0 && milestones.length === 0 ? (
            <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center" }}>
              <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>No skill data yet</div>
              <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 18 }}>Keep learning to build up skill and milestone tracking.</div>
              <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Explore courses</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {skills.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Mastery by skill</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
                    {skills.map((s) => (
                      <Card key={s.name} padding="sm">
                        <div style={{ fontSize: 12, color: color.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600, color: color.ink, marginTop: 4 }}>{s.score}%</div>
                        <Badge tone={(s.trend === "up" ? "success" : "neutral") as BadgeTone}>{s.trend === "up" ? "improving" : "steady"}</Badge>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {milestones.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Milestones</div>
                  <Card padding="md">
                    {milestones.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: i < milestones.length - 1 ? `1px solid ${color.borderMuted}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: color.ink }}>
                          <Icon name={m.status === "done" ? "checkCircle" : m.status === "urgent" ? "alertCircle" : "clock"} size={15} />
                          {m.title}
                        </div>
                        {m.days_away != null && <span style={{ fontSize: 12, color: color.textFaint, flexShrink: 0 }}>{m.days_away === 0 ? "today" : `${m.days_away}d`}</span>}
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </div>
          )
        ) : achError ? (
          <Card padding="md" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 14 }}>Failed to load achievements</p>
            <button onClick={loadAchievements} style={{ padding: "8px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: "1px solid #2B3A67", background: "#fff", color: "#2B3A67", cursor: "pointer" }}>Retry</button>
          </Card>
        ) : achLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div>
        ) : achievements.length === 0 ? (
          <div style={{ background: "#fff", border: `1px dashed ${color.border}`, borderRadius: 12, padding: "56px 30px", textAlign: "center" }}>
            <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 10 }}>No achievements yet</div>
            <div style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: 18 }}>Keep learning to unlock your first achievement.</div>
            <Link href="/paths" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 6, background: "#2B3A67", color: "#fff", textDecoration: "none" }}>Explore courses</Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 14 }}>{unlockedCount} of {achievements.length} unlocked</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 14 }}>
              {achievements.map((a) => {
                const rarity = RARITY_STYLE[a.rarity || "common"];
                const earned = !!a.unlockedAt;
                return (
                  <Card key={a.id} padding="md" style={{ opacity: earned ? 1 : 0.88 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ fontSize: 26 }}>{a.icon}</div>
                      <span style={{ fontFamily: font.mono, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 8px", borderRadius: 100, background: rarity.bg, color: rarity.fg }}>{a.rarity || "common"}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{a.name}</div>
                    {earned ? (
                      <div style={{ fontSize: 11.5, color: color.textFaint }}>{a.description}</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11.5, color: color.textFaint, marginBottom: 8 }}>{a.description}</div>
                        <div style={{ height: 5, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, a.progress ?? 0)}%`, background: color.textFaint, borderRadius: 100 }} />
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
