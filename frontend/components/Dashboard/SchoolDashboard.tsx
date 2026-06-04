import React, { useEffect, useState } from "react";
import Link from "next/link";

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

interface BuddyCard { user_id: string; name: string; online: boolean; streak_days: number; avg_score: number | null; }

export default function SchoolDashboard() {
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

  if (loading) {
    return (
      <div className="bg-surface-elevated border border-border rounded-2xl p-6 mb-6 animate-pulse h-40" />
    );
  }
  if (!data) return null;

  const maxHours = Math.max(data.weekly.weekly_goal_hours / 7, ...data.weekly.daily_breakdown.map((d) => d.hours), 0.5);

  return (
    <div className="mb-6 space-y-5">
      {/* Streak + today goal hero */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-surface-elevated border border-indigo-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-4">
            <span className="text-orange-400 font-semibold">🔥 {data.streak.current}-day streak</span>
            {data.streak.longest > data.streak.current && (
              <span className="text-white/40 text-sm">best: {data.streak.longest}</span>
            )}
          </div>
          <span className="text-white/50 text-sm">Recent quiz avg: {data.performance.recent_quiz_avg}%</span>
        </div>

        <p className="text-white/60 text-sm">Today&apos;s goal: {data.today.daily_goal_minutes} min</p>
        <div className="w-full h-3 bg-surface rounded-full overflow-hidden mt-2">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${data.today.progress_percent}%` }} />
        </div>
        <p className="text-white/40 text-xs mt-1.5">
          {data.today.time_spent_minutes} min today ({data.today.progress_percent}%)
        </p>
      </div>

      {/* Performance cards */}
      {data.performance.skills.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.performance.skills.map((s) => (
              <div key={s.name} className="bg-surface-elevated border border-border rounded-xl p-4">
                <div className="text-white/60 text-xs truncate">{s.name}</div>
                <div className="text-2xl font-bold text-white mt-1">{s.score}%</div>
                <div className={`text-xs mt-0.5 ${s.trend === "up" ? "text-green-400" : "text-white/40"}`}>
                  {s.trend === "up" ? "↑ mastered" : "→ steady"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly activity + milestones + achievements grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Weekly activity */}
        <div className="bg-surface-elevated border border-border rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">This week</h3>
          <div className="flex items-end justify-between gap-2 h-28">
            {data.weekly.daily_breakdown.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-surface rounded-md flex items-end" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-indigo-500/70 rounded-md transition-all"
                    style={{ height: `${Math.min(100, (d.hours / maxHours) * 100)}%` }}
                  />
                </div>
                <span className="text-white/40 text-[10px]">{d.day}</span>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs mt-3">
            Goal {data.weekly.weekly_goal_hours}h · done {data.weekly.total_this_week}h ({data.weekly.goal_percent}%)
          </p>
        </div>

        {/* Milestones */}
        <div className="bg-surface-elevated border border-border rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-3">Milestones</h3>
          {data.milestones.milestones.length === 0 ? (
            <p className="text-white/40 text-sm">Set goals in onboarding to see milestones.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.milestones.milestones.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-white/80 text-sm">
                    {m.status === "done" ? "✅" : m.status === "urgent" ? "🔴" : "🟡"} {m.title}
                  </span>
                  {m.days_away != null && (
                    <span className="text-white/40 text-xs flex-shrink-0">
                      {m.days_away === 0 ? "today" : `${m.days_away}d`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-surface-elevated border border-border rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">
          Achievements ({data.achievements.unlocked.length}/{data.achievements.unlocked.length + data.achievements.locked.length})
        </h3>
        <div className="flex flex-wrap gap-3">
          {data.achievements.unlocked.map((a) => (
            <div key={a.id} title={a.description} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              <span className="text-xl">{a.icon}</span>
              <span className="text-amber-300 text-sm font-medium">{a.name}</span>
            </div>
          ))}
          {data.achievements.locked.map((a) => (
            <div key={a.id} title={a.description} className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 opacity-50">
              <span className="text-xl grayscale">{a.icon}</span>
              <span className="text-white/50 text-sm">{a.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Study buddies */}
      <div className="bg-surface-elevated border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Study buddies</h3>
          <Link href="/buddies" className="text-accent text-sm hover:underline">Manage →</Link>
        </div>
        {buddies === null ? (
          <p className="text-white/30 text-sm mt-2">Loading…</p>
        ) : buddies.length === 0 ? (
          <p className="text-white/40 text-sm mt-2">
            No buddies yet — <Link href="/buddies" className="text-accent hover:underline">find one</Link> to stay accountable.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {buddies.slice(0, 3).map((b) => (
              <div key={b.user_id} className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${b.online ? 'bg-green-400' : 'bg-white/20'}`} />
                <span className="text-white/80 text-sm">{b.name}</span>
                <span className="text-white/30 text-xs ml-auto">
                  {b.online ? 'online' : 'offline'} · 🔥 {b.streak_days}d
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
