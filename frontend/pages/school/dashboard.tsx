import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

interface SchoolDashboard {
  organization: {
    id: string;
    name: string;
    school_type: string;
    status: string;
  };
  metrics: {
    total_students: number;
    active_this_week: number;
    teachers: number;
    classes: number;
    avg_student_progress: number;
    avg_student_score: number;
  };
  subscription: {
    tier: string;
    status: string;
  };
}

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function SchoolDashboard() {
  const [dashboard, setDashboard] = useState<SchoolDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Auth + school-admin-role access are enforced by the app shell (_app.tsx).
  useEffect(() => {
    const org = typeof window !== "undefined" ? localStorage.getItem("organization_id") : null;
    if (!org) {
      // No organisation linked yet — render the no-org state rather than bouncing.
      setLoading(false);
      return;
    }
    setOrgId(org);
    fetchDashboard(org);
  }, []);

  async function fetchDashboard(id: string) {
    try {
      const response = await fetch(`/api/schools/${id}/dashboard`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Failed to load dashboard");
      const data = await response.json();
      setDashboard(data);
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </>
    );
  }

  if (!dashboard || !orgId) {
    return (
      <>
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
          <div className="text-white">Failed to load dashboard</div>
        </div>
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {dashboard.organization.name}
              </h1>
              <p className="text-white/60">
                {dashboard.organization.school_type} | {dashboard.subscription.tier} Plan
              </p>
            </div>
            <Link href={`/school/${orgId}/settings`} className="px-4 py-2 bg-surface-elevated text-white rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
              Settings
            </Link>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.metrics.total_students}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm8 0c1.66 0 2.99-1.34 2.99-3S25.66 5 24 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.89 1.97 1.5 1.97 2.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Teachers</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.metrics.teachers}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Classes</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.metrics.classes}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 5L2.39 9.04 12 13l9.61-3.95L12 5z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Performance cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <p className="text-white/60 text-sm mb-2">Average Student Progress</p>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-2xl font-bold text-white">
                      {dashboard.metrics.avg_student_progress}%
                    </p>
                  </div>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-accent"
                      style={{
                        width: `${dashboard.metrics.avg_student_progress}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <p className="text-white/60 text-sm mb-2">Average Student Score</p>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-2xl font-bold text-white">
                      {dashboard.metrics.avg_student_score}%
                    </p>
                  </div>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-accent"
                      style={{
                        width: `${dashboard.metrics.avg_student_score}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Engagement */}
          <div className="bg-surface-elevated rounded-xl p-6 border border-border mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">This Week</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Active Students</p>
                <p className="text-3xl font-bold text-white">
                  {dashboard.metrics.active_this_week}
                </p>
                <p className="text-white/40 text-xs mt-1">
                  {Math.round((dashboard.metrics.active_this_week / dashboard.metrics.total_students) * 100)}% engagement
                </p>
              </div>
              <div className="w-24 h-24 rounded-full bg-surface-hover flex items-center justify-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(#00ff88 0deg ${(dashboard.metrics.active_this_week / dashboard.metrics.total_students) * 360}deg, rgba(0,0,0,0.2) 0deg)`,
                  }}
                >
                  <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {Math.round((dashboard.metrics.active_this_week / dashboard.metrics.total_students) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href={`/school/${orgId}/teachers`} className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Teachers</h3>
                  <p className="text-white/60 text-sm">Manage staff</p>
                </div>
              </div>
            </Link>

            <Link href={`/school/${orgId}/students`} className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm8 0c1.66 0 2.99-1.34 2.99-3S25.66 5 24 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.89 1.97 1.5 1.97 2.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Students</h3>
                  <p className="text-white/60 text-sm">View all students</p>
                </div>
              </div>
            </Link>

            <Link href={`/school/${orgId}/analytics`} className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Analytics</h3>
                  <p className="text-white/60 text-sm">View reports</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
