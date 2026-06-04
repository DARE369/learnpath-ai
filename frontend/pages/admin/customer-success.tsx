import React, { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, Mail, Flag } from "lucide-react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

interface OrgHealth {
  organization_id: string;
  organization_name: string;
  health_score: number;
  status: "healthy" | "at_risk" | "churning";
  subscription_tier: string;
  active_students: number;
  total_students: number;
  engagement_rate: number;
  is_churning: boolean;
  churn_triggers: string[];
  mrr: number;
  avg_score: number;
  completion_rate: number;
}

export default function CustomerSuccessDashboard() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "healthy" | "at_risk" | "churning">("all");
  const [selectedOrg, setSelectedOrg] = useState<OrgHealth | null>(null);
  const [notificationModal, setNotificationModal] = useState<{
    org: OrgHealth | null;
    type: "trial" | "invoice" | "alert";
  }>({ org: null, type: "trial" });

  const authHeaders = (): Record<string, string> => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
        : null;
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  };

  useEffect(() => {
    fetchOrgsHealth();
  }, []);

  const fetchOrgsHealth = async () => {
    try {
      const response = await fetch("/api/admin/customer-success/orgs/health", {
        headers: authHeaders(),
      });
      const data = await response.json();
      setOrgs(data.organizations || []);
    } catch (error) {
      console.error("Failed to fetch org health:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = filter === "all" ? orgs : orgs.filter((o) => o.status === filter);

  const totalMRR = orgs.reduce((sum, o) => sum + (o.mrr || 0), 0);
  const healthyCount = orgs.filter((o) => o.status === "healthy").length;
  const atRiskCount = orgs.filter((o) => o.status === "at_risk").length;
  const churningCount = orgs.filter((o) => o.status === "churning").length;

  const handleSendNotification = async (orgId: string, type: string) => {
    try {
      // Notify endpoints take { org_id } and derive the recipient (org admin
      // email) server-side; the outreach endpoint takes { reason }.
      const isOutreach = type === "alert";
      const endpoint = isOutreach
        ? "/api/admin/customer-success/orgs/" + orgId + "/send-outreach"
        : type === "trial"
        ? "/api/admin/customer-success/notify/trial-7-days"
        : "/api/admin/customer-success/notify/invoice-overdue";

      const body = isOutreach ? { reason: "low_engagement" } : { org_id: orgId };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.status === "sent" ? `${type} notification sent!` : `Could not send (${data.status || "error"})`);
        setNotificationModal({ org: null, type: "trial" });
      } else {
        alert(`Failed to send (HTTP ${response.status})`);
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
      alert("Failed to send notification");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading customer success data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Customer Success Dashboard - LearnPath Admin</title>
      </Head>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-surface-elevated border-b border-border sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white">Customer Success</h1>
                <p className="text-white/50 mt-1">Organization health & retention tracking</p>
              </div>
              <button
                onClick={fetchOrgsHealth}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-white/60 text-sm mb-1">Total MRR</div>
                <div className="text-2xl font-bold text-white">${totalMRR.toLocaleString()}</div>
              </div>

              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-green-400 text-sm mb-1">Healthy</div>
                <div className="text-2xl font-bold text-white">{healthyCount}</div>
              </div>

              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-yellow-400 text-sm mb-1">At Risk</div>
                <div className="text-2xl font-bold text-white">{atRiskCount}</div>
              </div>

              <div className="bg-surface rounded-lg p-4 border border-border">
                <div className="text-red-400 text-sm mb-1">Churning</div>
                <div className="text-2xl font-bold text-white">{churningCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Filter Buttons */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {(["all", "healthy", "at_risk", "churning"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === status
                    ? "bg-accent text-white"
                    : "bg-surface border border-border text-white/60 hover:text-white"
                }`}
              >
                {status === "all"
                  ? "All"
                  : status === "at_risk"
                  ? "At Risk"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Organization Grid */}
          <div className="grid gap-4">
            {filteredOrgs.map((org) => (
              <div
                key={org.organization_id}
                className={`bg-surface-elevated border rounded-lg p-6 hover:border-accent transition cursor-pointer ${
                  org.status === "churning"
                    ? "border-red-500/50"
                    : org.status === "at_risk"
                    ? "border-yellow-500/50"
                    : "border-border"
                }`}
                onClick={() => setSelectedOrg(org)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Organization Info */}
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{org.organization_name}</h3>
                        <p className="text-sm text-white/50">{org.subscription_tier} tier</p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          org.status === "healthy"
                            ? "bg-green-500/20 text-green-400"
                            : org.status === "at_risk"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {org.status === "at_risk" ? "At Risk" : org.status}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-white/70">
                        <span>Students:</span>
                        <span className="text-white font-medium">
                          {org.active_students}/{org.total_students}
                        </span>
                      </div>
                      <div className="flex justify-between text-white/70">
                        <span>MRR:</span>
                        <span className="text-white font-medium">${org.mrr.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Health Metrics */}
                  <div>
                    <div className="mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-white/70 text-sm">Health Score</span>
                        <span className="text-white font-semibold">{org.health_score}/100</span>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition ${
                            org.health_score >= 70
                              ? "bg-green-500"
                              : org.health_score >= 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${org.health_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-white/70">
                        <span>Engagement:</span>
                        <span className="text-white font-medium">{org.engagement_rate}%</span>
                      </div>
                      <div className="flex justify-between text-white/70">
                        <span>Avg Score:</span>
                        <span className="text-white font-medium">{org.avg_score}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-2">
                    {org.is_churning && (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-2">
                        <p className="flex items-center gap-1.5 text-red-400 text-sm font-medium mb-2"><AlertTriangle className="h-4 w-4" /> Churn Risks:</p>
                        <ul className="text-xs text-red-300/80 space-y-1">
                          {org.churn_triggers.map((trigger) => (
                            <li key={trigger}>• {trigger.replace(/_/g, " ")}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationModal({ org, type: "trial" });
                      }}
                      className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition text-sm font-medium"
                    >
                      <Mail className="h-4 w-4" /> Send Message
                    </button>

                    {org.is_churning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendNotification(org.organization_id, "alert");
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm font-medium"
                      >
                        <Flag className="h-4 w-4" /> Flag for Outreach
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOrgs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/50 text-lg">No organizations in this category</p>
            </div>
          )}
        </div>

        {/* Notification Modal */}
        {notificationModal.org && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface-elevated rounded-lg p-6 max-w-md w-full border border-border">
              <h2 className="text-xl font-bold text-white mb-4">Send Notification</h2>

              <p className="text-white/70 mb-6">
                Organization: <span className="font-semibold text-white">{notificationModal.org.organization_name}</span>
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => {
                    setNotificationModal({ ...notificationModal, type: "trial" });
                  }}
                  className={`w-full p-3 rounded-lg text-left transition ${
                    notificationModal.type === "trial"
                      ? "bg-accent text-white"
                      : "bg-surface border border-border text-white/70 hover:text-white"
                  }`}
                >
                  <div className="font-semibold">Trial Reminder</div>
                  <div className="text-sm opacity-70">7 days left notification</div>
                </button>

                <button
                  onClick={() => {
                    setNotificationModal({ ...notificationModal, type: "invoice" });
                  }}
                  className={`w-full p-3 rounded-lg text-left transition ${
                    notificationModal.type === "invoice"
                      ? "bg-accent text-white"
                      : "bg-surface border border-border text-white/70 hover:text-white"
                  }`}
                >
                  <div className="font-semibold">Invoice Reminder</div>
                  <div className="text-sm opacity-70">Payment overdue alert</div>
                </button>

                <button
                  onClick={() => {
                    setNotificationModal({ ...notificationModal, type: "alert" });
                  }}
                  className={`w-full p-3 rounded-lg text-left transition ${
                    notificationModal.type === "alert"
                      ? "bg-accent text-white"
                      : "bg-surface border border-border text-white/70 hover:text-white"
                  }`}
                >
                  <div className="font-semibold">Health Alert</div>
                  <div className="text-sm opacity-70">Organization at risk</div>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setNotificationModal({ org: null, type: "trial" })}
                  className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-white hover:bg-surface-hover transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSendNotification(notificationModal.org!.organization_id, notificationModal.type);
                  }}
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition font-semibold"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
