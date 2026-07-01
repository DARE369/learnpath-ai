import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page Not Found — LearnPath AI</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <p className="text-[120px] font-black leading-none select-none tabular-nums"
            style={{ color: "rgba(255,255,255,0.06)" }}>
            404
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Page not found</h1>
          <p className="mt-2 text-sm text-white/50 leading-relaxed">
            We couldn&apos;t find what you were looking for. The link might be broken or the page may have moved.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-sm transition-colors"
            >
              <Search className="h-4 w-4" />
              Explore courses
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
