import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Trophy, Lock, Target, CheckCircle2, AlertTriangle, Circle, Users, ArrowUpRight } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ProgressBar } from "../ui/ProgressBar";
import { SectionHeader } from "../ui/SectionHeader";
import { Skeleton } from "../ui/Skeleton";

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface DashboardData {
  streak: { current: number; longest: number };
  today: { daily_goal_minutes: number; time_spent_minutes: number; progress_percent: number };
  performance: { skills: { name: string; score: number; trend: string }[]; recent_quiz_avg: number };
  weekly: {
    daily_breakdown: { day: string; date: string; hours: number }[];
    weekly_goal_hours: number;
    total_this_week: number;
    goal_percent: number;
  };
  milestones: { milestones: { title: string; days_away: number | null; status: string }[] };
  achievements: {
    unlocked: { id: string; name: string; icon: string; description: string }[];
    locked: { id: string; name: string; icon: string; description: string }[];
  };
}

interface BuddyCard {
  user_id: string;
  name: string;
  online: boolean;
  streak_days: number;
  avg_score: number | null;
}

export default function LearnerHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buddies, setBuddies] = useState<BuddyCard[] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    fetch("/api/buddies/", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBuddies(d?.buddies ?? []))
      .catch(() => setBuddies([]));
  }, []);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  const maxHours = Math.max(
    data.weekly.weekly_goal_hours / 7,
    ...data.weekly.daily_breakdown.map((d) => d.hours),
    0.5,
  );
  const totalAchievements = data.achievements.unlocked.length + data.achievements.locked.length;

  return (
    <div className="space-y-6">
      {/* Today's goal */}
      <Card padding="lg" className="bg-gradient-to-br from-accent-muted to-surface">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-warning" />
            <span className="font-semibold text-white">{data.streak.current}-day streak</span>
            {data.streak.longest > data.streak.current && (
              <span className="text-sm text-white/40">best: {data.streak.longest}</span>
            )}
          </div>
          <span className="text-sm text-white/50">Recent quiz average: {data.performance.recent_quiz_avg}%</span>
        </div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-white/60">Today&apos;s goal: {data.today.daily_goal_minutes} min</span>
          <span className="font-medium text-white/70 tabular-nums">{data.today.progress_percent}%</span>
        </div>
        <ProgressBar value={data.today.progress_percent} />
        <p className="mt-1.5 text-xs text-white/40">{data.today.time_spent_minutes} min today</p>
      </Card>

      {/* Performance skills */}
      {data.performance.skills.length > 0 && (
        <div>
          <SectionHeader title="Performance" subtitle="Mastery by skill" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.performance.skills.map((s) => (
              <Card key={s.name} padding="sm">
                <p className="truncate text-xs text-white/50">{s.name}</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">{s.score}%</p>
                <Badge tone={s.trend === "up" ? "success" : "neutral"} className="mt-1">
                  {s.trend === "up" ? "improving" : "steady"}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Weekly + milestones */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card padding="md">
          <SectionHeader title="This week" />
          <div className="flex h-28 items-end justify-between gap-2">
            {data.weekly.daily_breakdown.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end rounded-md bg-surface-elevated" style={{ height: "80px" }}>
                  <div
                    className="w-full rounded-md bg-accent/70 transition-all"
                    style={{ height: `${Math.min(100, (d.hours / maxHours) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/40">{d.day}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/50">
            Goal {data.weekly.weekly_goal_hours}h · done {data.weekly.total_this_week}h ({data.weekly.goal_percent}%)
          </p>
        </Card>

        <Card padding="md">
          <SectionHeader title="Milestones" />
          {data.milestones.milestones.length === 0 ? (
            <p className="text-sm text-white/40">Set goals in onboarding to see milestones.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.milestones.milestones.map((m, i) => {
                const Icon = m.status === "done" ? CheckCircle2 : m.status === "urgent" ? AlertTriangle : Circle;
                const color = m.status === "done" ? "text-success" : m.status === "urgent" ? "text-error" : "text-warning";
                return (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-white/80">
                      <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                      {m.title}
                    </span>
                    {m.days_away != null && (
                      <span className="flex-shrink-0 text-xs text-white/40">
                        {m.days_away === 0 ? "today" : `${m.days_away}d`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Achievements */}
      <Card padding="md">
        <SectionHeader title="Achievements" subtitle={`${data.achievements.unlocked.length} of ${totalAchievements} unlocked`} />
        <div className="flex flex-wrap gap-3">
          {data.achievements.unlocked.map((a) => (
            <div key={a.id} title={a.description} className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-muted px-3 py-2">
              <Trophy className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">{a.name}</span>
            </div>
          ))}
          {data.achievements.locked.map((a) => (
            <div key={a.id} title={a.description} className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2 opacity-50">
              <Lock className="h-4 w-4 text-white/40" />
              <span className="text-sm text-white/50">{a.name}</span>
            </div>
          ))}
          {totalAchievements === 0 && (
            <p className="flex items-center gap-2 text-sm text-white/40">
              <Target className="h-4 w-4" /> Keep learning to unlock achievements.
            </p>
          )}
        </div>
      </Card>

      {/* Study buddies */}
      <Card padding="md">
        <SectionHeader
          title="Study buddies"
          action={
            <Link href="/buddies" className="inline-flex items-center gap-1 text-sm text-accent-light hover:text-accent">
              Manage <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {buddies === null ? (
          <Skeleton className="h-10 w-full" />
        ) : buddies.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-white/40">
            <Users className="h-4 w-4" />
            No buddies yet — <Link href="/buddies" className="text-accent-light hover:text-accent">find one</Link> to stay accountable.
          </p>
        ) : (
          <div className="space-y-2">
            {buddies.slice(0, 3).map((b) => (
              <div key={b.user_id} className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${b.online ? "bg-success" : "bg-white/20"}`} />
                <span className="text-sm text-white/80">{b.name}</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-white/30">
                  {b.online ? "online" : "offline"} · <Flame className="h-3 w-3 text-warning/70" /> {b.streak_days}d
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
