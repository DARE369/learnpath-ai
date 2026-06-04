import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface TeacherDashboard {
  teacher: {
    id: string;
    name: string;
    email: string;
    classes_count: number;
  };
  this_week: {
    active_students: number;
    avg_score: number;
    total_study_time_hours: number;
  };
  classes: Array<{
    id: string;
    name: string;
    subject: string;
    enrolled: number;
    max: number;
  }>;
}

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function TeacherDashboard() {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth + teacher-role access are enforced by the app shell (_app.tsx).
  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const response = await fetch("/api/teachers/dashboard", { headers: authHeaders() });
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

  if (!dashboard) {
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
          {/* Welcome section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Welcome back, {dashboard.teacher.name}
            </h1>
            <p className="text-white/60">
              You have {dashboard.teacher.classes_count} active class
              {dashboard.teacher.classes_count !== 1 ? "es" : ""}
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Active This Week</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.this_week.active_students}
                  </p>
                  <p className="text-white/40 text-xs mt-1">students</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-accent"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.this_week.avg_score}%
                  </p>
                  <p className="text-white/40 text-xs mt-1">all classes</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-accent"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-2.08-2.88c-.3-.4-.93-.5-1.36-.2-.44.3-.55.92-.25 1.36l2.99 4.15c.25.33.64.52 1.04.52.4 0 .79-.19 1.04-.52l3.86-5.04c.3-.44.2-1.06-.24-1.36-.45-.29-1.06-.2-1.36.25z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">My Classes</p>
                  <p className="text-3xl font-bold text-white">
                    {dashboard.teacher.classes_count}
                  </p>
                  <p className="text-white/40 text-xs mt-1">active</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-accent/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-accent"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm8 0c1.66 0 2.99-1.34 2.99-3S25.66 5 24 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.89 1.97 1.5 1.97 2.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Classes section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Your Classes</h2>
              <Link href="/teacher/class/create" className="px-4 py-2 bg-gradient-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Add Class
              </Link>
            </div>

            {dashboard.classes.length === 0 ? (
              <div className="bg-surface-elevated rounded-xl p-12 border border-border text-center">
                <p className="text-white/60 mb-4">No classes yet</p>
                <Link href="/teacher/class/create" className="inline-flex items-center gap-1 text-accent hover:text-accent/80">
                  Create your first class <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboard.classes.map((cls) => (
                  <Link key={cls.id} href={`/teacher/class/${cls.id}`}>
                    <div className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                            {cls.name}
                          </h3>
                          <p className="text-sm text-white/60">{cls.subject}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">
                          {cls.enrolled} / {cls.max} students
                        </span>
                        <div className="w-12 h-1 bg-surface-hover rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-accent"
                            style={{
                              width: `${(cls.enrolled / cls.max) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-accent text-xs font-medium">
                        View Details
                        <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/teacher/at-risk" className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-error/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-error" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">At-Risk Students</h3>
                  <p className="text-white/60 text-sm">Review students who need support</p>
                </div>
              </div>
            </Link>

            <Link href="/teacher/assignments" className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Assignments</h3>
                  <p className="text-white/60 text-sm">Create and manage assignments</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
