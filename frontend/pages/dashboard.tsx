import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { useProgress } from "../hooks/useProgress";
import { useDashboardData } from "../hooks/useDashboardData";
import { Card, LinkButton, Badge, ThresholdRing, SectionLabel, Skeleton, InlineError, type BadgeTone } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";
import { streakTierMessage } from "../ui-v2/streak";
import RecommendedCourses from "../components/Dashboard/RecommendedCourses";
import RecentActivity from "../components/Dashboard/RecentActivity";
import TopicsChart from "../components/Dashboard/TopicsChart";
import ProgressChart from "../components/Dashboard/ProgressChart";

// ─── Local types (unchanged data shapes from the endpoints already in use) ──

interface ReadinessScore {
  subject_id: string;
  subject_name: string;
  score: number;
  weak_topics: string[];
  score_history: number[];
  updated_at: string | null;
}

interface ActivePath {
  id: string;
  path_name: string;
  completed_modules: number;
  total_modules: number;
  progress_percent: number;
}

interface Buddy {
  user_id: string;
  name: string;
  online: boolean;
  streak_days: number;
  avg_score: number | null;
  connection_id: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
}

function getGreeting(): { emoji: string; text: string; secondary: string } {
  const h = new Date().getHours();
  if (h < 12) return { emoji: "🌤️", text: "Good morning", secondary: "Morning learners retain more — great time to get ahead." };
  if (h < 17) return { emoji: "☀️", text: "Good afternoon", secondary: "Keep the momentum going. You're doing great." };
  return { emoji: "🌙", text: "Good evening", secondary: "Evening sessions are great for review and consolidation." };
}

function readinessLabel(score: number): { label: string; tone: BadgeTone } {
  if (score >= 80) return { label: "Ready", tone: "success" };
  if (score >= 60) return { label: "On track", tone: "success" };
  if (score >= 40) return { label: "Needs work", tone: "warning" };
  return { label: "Just starting", tone: "danger" };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const greeting = getGreeting();

  const { stats, streak, weekly } = useProgress();

  const [period, setPeriod] = useState<"week" | "all">("all");
  const weekVideos = weekly.reduce((s, d) => s + (d.videos ?? 0), 0);
  const weekHours = weekly.reduce((s, d) => s + (d.minutes ?? 0), 0) / 60;
  const daysStudiedThisWeek = weekly.filter((d) => (d.videos ?? 0) > 0 || (d.minutes ?? 0) > 0).length;

  const displayStats =
    period === "week"
      ? { videos: weekVideos, concepts: stats.conceptsMastered, courses: stats.coursesStarted, hours: weekHours }
      : { videos: stats.videosWatched, concepts: stats.conceptsMastered, courses: stats.coursesStarted, hours: stats.hoursLearned };

  // Active path + exam readiness — same endpoints the previous dashboard used;
  // the usage/plan-limit alert fetch was cut along with its banner (see
  // decision note below) rather than ported here.
  const [activePath, setActivePath] = useState<ActivePath | null>(null);
  const [pathLoaded, setPathLoaded] = useState(false);
  const [readinessScores, setReadinessScores] = useState<ReadinessScore[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    const headers = { Authorization: `Bearer ${t}` };

    fetch("/api/adaptive-paths/active", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setActivePath(d?.path ?? null))
      .catch(() => setActivePath(null))
      .finally(() => setPathLoaded(true));

    fetch("/api/curriculum/readiness", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.scores && setReadinessScores(d.scores))
      .catch(() => {});

    fetch("/api/buddies/", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBuddies((d?.buddies ?? []).slice(0, 3)))
      .catch(() => {});
  }, []);

  const { recs, recsLoading, recsError, loadRecs, activityItems, activityLoading, activityError, loadActivity, topicsData, topicsLoading, rateLimitCountdown, isRateLimited } =
    useDashboardData();

  return (
    <>
      <Head>
        <title>Dashboard — LearnPath AI</title>
      </Head>

      <div>
        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{greeting.emoji}</span>
            {greeting.text}, {firstName}.
          </h1>
          <div style={{ fontSize: 13, color: color.textFaint, marginTop: 4 }}>{greeting.secondary}</div>
        </div>

        {isRateLimited && (
          <div
            style={{
              border: `1px solid #E7B7AE`,
              background: color.danger.bg,
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 20,
              fontSize: 13.5,
              color: "#7A2A20",
            }}
          >
            Too many requests. Dashboard data will refresh in <b>{rateLimitCountdown}s</b>.
          </div>
        )}

        {/* Continue learning + this week */}
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 20, marginBottom: 20 }}>
          <Card padding="lg" dark style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: color.chromeTextFaint, marginBottom: 10 }}>
                Continue learning
              </div>
              {activePath ? (
                <>
                  <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 22, marginBottom: 8 }}>{activePath.path_name}</div>
                  <div style={{ fontSize: 13, color: color.chromeTextMuted, marginBottom: 18 }}>
                    {activePath.completed_modules}/{activePath.total_modules} modules · {activePath.progress_percent}% complete
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 22, marginBottom: 8 }}>Ready to learn something new?</div>
                  <div style={{ fontSize: 13, color: color.chromeTextMuted, marginBottom: 18 }}>
                    {pathLoaded ? "Pick a topic and we'll build a personalised path in seconds." : "Loading your progress…"}
                  </div>
                </>
              )}
            </div>
            {activePath ? (
              <div>
                <div style={{ height: 6, background: "#2A2E3A", borderRadius: 100, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${activePath.progress_percent}%`, background: "#C8792A", borderRadius: 100 }} />
                </div>
                <LinkButton href={`/paths/${activePath.id}`} variant="secondary" style={{ background: "#F4F1EA", borderColor: "#F4F1EA", color: color.ink }}>
                  Resume — {activePath.progress_percent}% complete
                </LinkButton>
              </div>
            ) : (
              <LinkButton href="/paths" variant="secondary" style={{ background: "#F4F1EA", borderColor: "#F4F1EA", color: color.ink }}>
                Explore topics
              </LinkButton>
            )}
          </Card>

          <Card padding="lg" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flexShrink: 0 }}>
              <ThresholdRing pct={Math.round((daysStudiedThisWeek / 7) * 100)} threshold={0} size={64} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.textFaint, marginBottom: 6 }}>
                This week
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {streak}-day streak
              </div>
              <div style={{ fontSize: 13, color: color.inkSoft }}>{streakTierMessage(streak)}</div>
              <div style={{ fontSize: 12, color: color.textFaint, marginTop: 4 }}>{daysStudiedThisWeek} of 7 study days this week</div>
            </div>
          </Card>
        </div>

        {/* Stats */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft }}>Your progress</div>
            <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 7, padding: 3 }}>
              {(["week", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 5,
                    cursor: "pointer",
                    border: "none",
                    background: period === p ? "#fff" : "transparent",
                    color: period === p ? color.ink : color.textFaint,
                  }}
                >
                  {p === "week" ? "This week" : "All time"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <StatTileV2 value={displayStats.videos} label="Videos watched" href="/activity" />
            <StatTileV2 value={displayStats.concepts} label="Concepts mastered" href="/concepts" />
            <StatTileV2 value={displayStats.courses} label="Courses started" href="/paths" />
            <StatTileV2 value={displayStats.hours.toFixed(1)} label={`Hours learned${period === "week" ? " (week)" : ""}`} href="/activity" />
          </div>
        </div>

        {/* Progress charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20, marginBottom: 24 }}>
          <ProgressChart data={weekly} />
          <TopicsChart data={topicsData} isLoading={topicsLoading} />
        </div>

        {/* Exam readiness + Study buddies */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 24 }}>
          {readinessScores.length > 0 && (
            <div>
              <SectionLabel>Exam readiness</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {readinessScores.map((r) => {
                  const { label, tone } = readinessLabel(r.score);
                  return (
                    <Card key={r.subject_id} padding="md" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flexShrink: 0 }}>
                        <ThresholdRing pct={r.score} size={52} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{r.subject_name}</div>
                        {r.weak_topics.length > 0 && (
                          <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 2 }}>Weak: {r.weak_topics.slice(0, 2).join(", ")}</div>
                        )}
                      </div>
                      <Badge tone={tone}>{label}</Badge>
                      <Link
                        href={`/paths?q=${encodeURIComponent(r.subject_name)}&autorun=1`}
                        style={{ fontSize: 11.5, color: "#2B3A67", fontWeight: 600, textDecoration: "none", flexShrink: 0, width: "100%" }}
                      >
                        Study now →
                      </Link>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Study buddies</SectionLabel>
            <Card padding="md">
              {buddies.length === 0 ? (
                <p style={{ fontSize: 13, color: color.textFaint, margin: 0 }}>
                  No buddies yet.{" "}
                  <Link href="/buddies" style={{ color: "#2B3A67" }}>
                    Find one to stay accountable →
                  </Link>
                </p>
              ) : (
                buddies.map((b) => (
                  <div key={b.connection_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${color.borderMuted}` }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: color.surfaceElevated, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: color.inkSoft }}>
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: b.online ? color.success.fg : "#D9D5C9",
                          border: "2px solid #fff",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                    <div style={{ fontFamily: font.mono, fontSize: 12, color: color.textFaint, flexShrink: 0 }}>{b.streak_days}d</div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>

        {/* Study tools */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          <Link href="/upload" style={{ textDecoration: "none" }}>
            <Card padding="md" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18 }}>↑</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: color.ink }}>Upload your own material</div>
                <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>Turn a doc or photo into notes, flashcards &amp; a quiz</div>
              </div>
            </Card>
          </Link>
          <Link href="/notes" style={{ textDecoration: "none" }}>
            <Card padding="md" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18 }}>☰</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: color.ink }}>Study notes library</div>
                <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>Revisit AI notes from videos you&rsquo;ve watched</div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Recommended */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel
            action={
              <Link href="/paths" style={{ fontSize: 12.5, color: "#2B3A67", textDecoration: "none", fontWeight: 600 }}>
                See all →
              </Link>
            }
          >
            Recommended for you
          </SectionLabel>
          {recsLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 140 }} />
              ))}
            </div>
          ) : recsError ? (
            <InlineError message="Failed to load data" onRetry={loadRecs} />
          ) : recs && recs.length > 0 ? (
            <RecommendedCourses courses={recs} />
          ) : (
            <Card padding="md" style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 13.5, color: color.inkSoft, margin: 0 }}>
                No recommendations yet.{" "}
                <Link href="/paths" style={{ color: "#2B3A67" }}>
                  Explore courses
                </Link>{" "}
                to get started.
              </p>
            </Card>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <SectionLabel
            action={
              <Link href="/activity" style={{ fontSize: 12.5, color: "#2B3A67", textDecoration: "none", fontWeight: 600 }}>
                View full history →
              </Link>
            }
          >
            Recent activity
          </SectionLabel>
          {activityLoading ? (
            <Card padding="md">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 44, marginBottom: i < 3 ? 8 : 0 }} />
              ))}
            </Card>
          ) : activityError ? (
            <InlineError message="Failed to load data" onRetry={loadActivity} />
          ) : !activityItems || activityItems.length === 0 ? (
            <Card padding="md" style={{ textAlign: "center", padding: "32px 20px" }}>
              <p style={{ fontSize: 13.5, color: color.inkSoft, margin: 0 }}>
                No activity yet. Start learning to see your history here.{" "}
                <Link href="/paths" style={{ color: "#2B3A67" }}>
                  Explore courses →
                </Link>
              </p>
            </Card>
          ) : (
            <Card padding="md">
              <RecentActivity items={activityItems} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function StatTileV2({ value, label, href }: { value: string | number; label: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Card padding="md">
        <div style={{ fontFamily: font.mono, fontSize: 24, fontWeight: 600, color: color.ink }}>{value}</div>
        <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>{label}</div>
      </Card>
    </Link>
  );
}
