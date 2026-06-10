import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { BarChart3, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Skeleton, Badge, EmptyState } from "../../../components/ui";
import type { TeacherClass } from "../../../components/Teacher/types";

export default function AnalyticsOverviewPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/teachers/dashboard", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <>
      <Head><title>Analytics — LearnPath AI</title></Head>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-white/40">Pick a class to see scores, trends, distribution, and at-risk forecasts.</p>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : !classes || classes.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No classes yet" description="Create a class to start seeing analytics." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <button
                key={c.class_id}
                onClick={() => router.push(`/teacher/analytics/${c.class_id}`)}
                className="text-left"
              >
                <Card padding="md" interactive>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">{c.class_name}</h3>
                      <p className="text-xs text-white/40">{c.student_count} students</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-white/30" />
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <div><p className="text-lg font-bold text-white tabular-nums">{c.avg_score}%</p><p className="text-xs text-white/40">avg score</p></div>
                    <div><p className="text-lg font-bold text-white tabular-nums">{c.completion_rate}%</p><p className="text-xs text-white/40">completion</p></div>
                    {c.at_risk_count > 0 && (
                      <Badge tone="error" icon={<AlertTriangle className="h-3.5 w-3.5" />} className="ml-auto">{c.at_risk_count}</Badge>
                    )}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
