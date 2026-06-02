import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Navbar from "../../../components/Navbar";

interface Student {
  id: string;
  progress: number;
  avg_score: number;
  last_active: string | null;
  status: string;
}

interface ClassDetails {
  class: {
    id: string;
    name: string;
    subject: string;
    description: string;
  };
  students: Student[];
  summary: {
    total: number;
    active: number;
    avg_progress: number;
    avg_score: number;
  };
}

export default function ClassPage() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState<any>(null);
  const [classData, setClassData] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "at-risk">("all");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/auth/login");
      return;
    }
    setUser(JSON.parse(userData));
    if (id) fetchClassDetails();
  }, [id]);

  async function fetchClassDetails() {
    try {
      const response = await fetch(`/api/teachers/classes/${id}`);
      if (!response.ok) throw new Error("Failed to load class");
      const data = await response.json();
      setClassData(data);
    } catch (error) {
      console.error("Class load error:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    router.push("/");
  }

  if (loading) {
    return (
      <>
        <Navbar user={user} onLogout={handleLogout} />
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </>
    );
  }

  if (!classData) {
    return (
      <>
        <Navbar user={user} onLogout={handleLogout} />
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
          <div className="text-white">Failed to load class</div>
        </div>
      </>
    );
  }

  const getFilteredStudents = () => {
    const { students, summary } = classData;
    switch (filter) {
      case "active":
        return students.filter((s) => s.last_active && new Date(s.last_active) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      case "at-risk":
        return students.filter((s) => s.avg_score < 60 || s.progress < 20);
      default:
        return students;
    }
  };

  const filteredStudents = getFilteredStudents();
  const { summary } = classData;

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      <main className="min-h-screen bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <Link href="/teacher/dashboard" className="text-accent hover:text-accent/80 text-sm mb-4 inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold text-white mb-2">
              {classData.class.name}
            </h1>
            <p className="text-white/60">{classData.class.subject}</p>
            {classData.class.description && (
              <p className="text-white/40 text-sm mt-2">{classData.class.description}</p>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-elevated rounded-xl p-4 border border-border">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Total Students</p>
              <p className="text-3xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="bg-surface-elevated rounded-xl p-4 border border-border">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Active This Week</p>
              <p className="text-3xl font-bold text-white">{summary.active}</p>
            </div>
            <div className="bg-surface-elevated rounded-xl p-4 border border-border">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Avg Progress</p>
              <p className="text-3xl font-bold text-white">{summary.avg_progress}%</p>
            </div>
            <div className="bg-surface-elevated rounded-xl p-4 border border-border">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1">Avg Score</p>
              <p className="text-3xl font-bold text-white">{summary.avg_score}%</p>
            </div>
          </div>

          {/* Students section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Students ({filteredStudents.length})</h2>
              <div className="flex gap-2">
                {["all", "active", "at-risk"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filter === f
                        ? "bg-gradient-accent text-white"
                        : "bg-surface-elevated text-white/60 hover:text-white"
                    }`}
                  >
                    {f === "all" ? "All" : f === "active" ? "Active" : "At-Risk"}
                  </button>
                ))}
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="bg-surface-elevated rounded-xl p-8 border border-border text-center">
                <p className="text-white/60">
                  No students in "{filter}" filter
                </p>
              </div>
            ) : (
              <div className="bg-surface-elevated rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Student ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Last Active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-3 text-sm text-white font-medium">
                            {student.id.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-surface-hover rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-accent"
                                  style={{ width: `${student.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-white/60">{student.progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm">
                            <span
                              className={
                                student.avg_score >= 70
                                  ? "text-green-400"
                                  : student.avg_score >= 50
                                  ? "text-yellow-400"
                                  : "text-error"
                              }
                            >
                              {student.avg_score}%
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                student.status === "active"
                                  ? "bg-green-400/20 text-green-400"
                                  : "bg-white/10 text-white/60"
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-white/60">
                            {student.last_active
                              ? new Date(student.last_active).toLocaleDateString()
                              : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/teacher/class/${id}/assign`} className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <h3 className="text-white font-semibold mb-1">Assign Content</h3>
              <p className="text-white/60 text-sm">Create assignment or quiz</p>
            </Link>
            <Link href={`/teacher/class/${id}/analytics`} className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-accent/50 transition-all">
              <h3 className="text-white font-semibold mb-1">View Analytics</h3>
              <p className="text-white/60 text-sm">Class-wide performance data</p>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
