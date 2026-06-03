import React from "react";
import Head from "next/head";
import Link from "next/link";

interface AdminTool {
  href: string;
  title: string;
  description: string;
  icon: string;
}

const ADMIN_TOOLS: AdminTool[] = [
  {
    href: "/admin/customer-success",
    title: "Customer Success",
    description: "Organization health scores, churn risk, and CS outreach emails.",
    icon: "💚",
  },
  {
    href: "/admin/analytics",
    title: "Platform Analytics",
    description: "Revenue, churn, cohorts, and platform-wide usage metrics.",
    icon: "📊",
  },
  {
    href: "/admin/confidence",
    title: "EQS Confidence",
    description: "Expanded video quality scores and confidence dashboard.",
    icon: "🎯",
  },
  {
    href: "/admin/blacklist",
    title: "Video Blacklist",
    description: "Review and manage soft/hard-blacklisted videos.",
    icon: "🚫",
  },
  {
    href: "/admin/expansion",
    title: "Topic Expansion",
    description: "Nightly expansion runs, popular topics, and aliases.",
    icon: "🌱",
  },
];

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
                <div className="text-3xl mb-3">{tool.icon}</div>
                <h2 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
                  {tool.title}
                </h2>
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
                  {tool.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
