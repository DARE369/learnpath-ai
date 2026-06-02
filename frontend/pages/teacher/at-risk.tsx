import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Navbar from "../../components/Navbar";

interface AtRiskStudent {
  student_id: string;
  reasons: string[];
  recommended_action: string;
}

interface AtRiskData {
  at_risk_count: number;
  at_risk_students: AtRiskStudent[];
}

export default function AtRiskStudents() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [atRiskData, setAtRiskData] = useState<AtRiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/auth/login");
      return;
    }
    setUser(JSON.parse(userData));
    fetchAtRiskStudents();
  }, []);

  async function fetchAtRiskStudents() {
    try {
      const response = await fetch("/api/teachers/at-risk");
      if (!response.ok) throw new Error("Failed to load at-risk students");
      const data = await response.json();
      setAtRiskData(data);
    } catch (error) {
      console.error("Load error:", error);
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

  if (!atRiskData) {
    return (
      <>
        <Navbar user={user} onLogout={handleLogout} />
        <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
          <div className="text-white">Failed to load data</div>
        </div>
      </>
    );
  }

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
            <h1 className="text-4xl font-bold text-white mb-2">At-Risk Students</h1>
            <p className="text-white/60">
              {atRiskData.at_risk_count} student{atRiskData.at_risk_count !== 1 ? "s" : ""} need intervention
            </p>
          </div>

          {/* Status card */}
          <div className="mb-8 bg-error/20 rounded-xl p-6 border border-error/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-error/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Monitor Student Progress</h3>
                <p className="text-white/70 text-sm">
                  These students are struggling based on recent activity and scores. Consider reaching out to provide support.
                </p>
              </div>
            </div>
          </div>

          {/* Students list */}
          {atRiskData.at_risk_students.length === 0 ? (
            <div className="bg-surface-elevated rounded-xl p-12 border border-border text-center">
              <div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
              <p className="text-white font-semibold mb-2">Great job!</p>
              <p className="text-white/60">All your students are doing well</p>
            </div>
          ) : (
            <div className="space-y-4">
              {atRiskData.at_risk_students.map((student) => (
                <div
                  key={student.student_id}
                  className="bg-surface-elevated rounded-xl p-6 border border-border hover:border-error/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-2">
                        Student {student.student_id.slice(0, 8)}...
                      </h3>
                      <div className="space-y-1 mb-3">
                        {student.reasons.map((reason, idx) => (
                          <p key={idx} className="text-error text-sm flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-error" />
                            {reason}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11 8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0-7C6.48 3 2 6.48 2 11s4.48 8 9 8 9-3.48 9-8-4.48-8-9-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
                        </svg>
                        <span className="text-accent text-sm">{student.recommended_action}</span>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-surface-hover text-white rounded-lg text-sm font-medium hover:bg-surface-elevated transition-colors flex-shrink-0">
                      Reach Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Intervention strategies */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Recommended Actions
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Assign focused review content for struggling topics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Offer one-on-one tutoring sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Create study groups with higher-performing peers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Check in regularly to maintain engagement</span>
                </li>
              </ul>
            </div>

            <div className="bg-surface-elevated rounded-xl p-6 border border-border">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 7h-2v6h2V7zm0 8h-2v2h2v-2zm-6-8h2v6H7V7zm6-6H9c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2z" />
                </svg>
                Track Progress
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Monitor completion rates daily</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Check assessment scores regularly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Review engagement metrics weekly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">→</span>
                  <span>Celebrate small wins and improvements</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
