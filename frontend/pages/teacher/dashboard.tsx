import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ClipboardList, MessageSquare, BookOpen, BarChart3 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Card, Button, Skeleton } from "../../components/ui";
import ClassOverviewCards from "../../components/Teacher/ClassOverviewCards";
import AtRiskAlerts from "../../components/Teacher/AtRiskAlerts";
import QuickMetrics from "../../components/Teacher/QuickMetrics";
import RecentActivity from "../../components/Teacher/RecentActivity";
import type { TeacherDashboard } from "../../components/Teacher/types";

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachers/dashboard", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setError("Couldn't load your dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = (user?.fullName || user?.email || "").split(/[\s@]/)[0];
  const viewClass = (classId: string) => router.push(`/teacher/class/${classId}`);

  return (
    <>
      <Head><title>Teacher Dashboard — LearnPath AI</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Your dashboard</h1>
          <p className="mt-1 text-sm text-white/40">
            {firstName ? `Welcome back, ${firstName}. ` : ""}Manage your classes and students at a glance.
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <Card>
            <p className="text-sm text-error">{error}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={load}>Retry</Button>
          </Card>
        ) : data ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <ClassOverviewCards classes={data.classes} onView={viewClass} />
              <AtRiskAlerts alerts={data.alerts} onViewProfile={viewClass} />
              <RecentActivity activities={data.recent_activity} />
            </div>

            <div className="space-y-6">
              <QuickMetrics metrics={data.metrics} />
              <Card padding="md">
                <h3 className="mb-3 text-sm font-semibold text-white">Quick actions</h3>
                <div className="space-y-1.5">
                  <Action icon={<ClipboardList className="h-4 w-4" />} label="Create assignment" onClick={() => router.push("/teacher/assignments")} />
                  <Action icon={<MessageSquare className="h-4 w-4" />} label="Message a student" soon />
                  <Action icon={<BookOpen className="h-4 w-4" />} label="Assign content" soon />
                  <Action icon={<BarChart3 className="h-4 w-4" />} label="View analytics" onClick={() => router.push("/teacher/at-risk")} />
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Action({ icon, label, onClick, soon }: { icon: React.ReactNode; label: string; onClick?: () => void; soon?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soon}
      title={soon ? "Coming soon" : undefined}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex items-center gap-2.5">{icon}{label}</span>
      {soon && <span className="text-[10px] uppercase tracking-wide text-white/30">soon</span>}
    </button>
  );
}
