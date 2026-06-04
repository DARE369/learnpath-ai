'use client';

import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { HeartPulse, BarChart3, Target, Ban, Sprout, Network, ArrowRight } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface AdminTool {
  href: string;
  title: string;
  description: string;
  icon: IconType;
}

const ADMIN_TOOLS: AdminTool[] = [
  {
    href: "/admin/customer-success",
    title: "Customer Success",
    description: "Organization health scores, churn risk, and CS outreach emails.",
    icon: HeartPulse,
  },
  {
    href: "/admin/analytics",
    title: "Platform Analytics",
    description: "Revenue, churn, cohorts, and platform-wide usage metrics.",
    icon: BarChart3,
  },
  {
    href: "/admin/confidence",
    title: "EQS Confidence",
    description: "Expanded video quality scores and confidence dashboard.",
    icon: Target,
  },
  {
    href: "/admin/blacklist",
    title: "Video Blacklist",
    description: "Review and manage soft/hard-blacklisted videos.",
    icon: Ban,
  },
  {
    href: "/admin/expansion",
    title: "Topic Expansion",
    description: "Nightly expansion runs, popular topics, and aliases.",
    icon: Sprout,
  },
];

function SeedKnowledgeGraph() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const seed = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/knowledge/seed", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setMsg(
        `Added ${data.concepts_added} concept${data.concepts_added === 1 ? "" : "s"} and ` +
        `${data.relationships_added} relationship${data.relationships_added === 1 ? "" : "s"}.`
      );
    } catch (e) {
      setMsg(e instanceof Error ? `Failed: ${e.message}` : "Failed to seed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-elevated border border-border rounded-2xl p-6">
      <Network className="h-7 w-7 mb-3 text-accent-light" />
      <h2 className="text-lg font-semibold text-white">Concept Graph</h2>
      <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
        Bootstrap the knowledge graph from existing content (quiz concepts,
        mastery, progress) and infer prerequisite/related links.
      </p>
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          onClick={seed}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Seeding…" : "Seed graph"}
        </button>
        <Link href="/concepts" className="inline-flex items-center gap-1 text-accent text-sm hover:underline">
          View concepts <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {msg && <p className="text-white/60 text-xs mt-3">{msg}</p>}
    </div>
  );
}

export default function AdminHome() {
  return (
    <>
      <Head>
        <title>Admin — LearnPath AI</title>
      </Head>

      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Admin</h1>
            <p className="text-white/50 mt-1">
              Internal tools — visible only to admin accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ADMIN_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group bg-surface-elevated border border-border rounded-2xl p-6 hover:border-accent transition-colors"
              >
                <tool.icon className="h-7 w-7 mb-3 text-accent-light" />
                <h2 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                  {tool.title}
                </h2>
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                  {tool.description}
                </p>
              </Link>
            ))}

            {/* Action card (not a link) — seeds the concept knowledge graph */}
            <SeedKnowledgeGraph />
          </div>
        </div>
      </div>
    </>
  );
}
