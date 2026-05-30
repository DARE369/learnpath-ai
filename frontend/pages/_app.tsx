import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Navbar from "../components/Navbar";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ProgressProvider } from "../hooks/useProgress";
import "../styles/globals.css";

const NO_CHROME_PATHS = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/explore",
  "/courses",
  "/learning",
  "/settings",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function hidesChrome(pathname: string): boolean {
  return NO_CHROME_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function Shell({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const showChrome = !hidesChrome(router.pathname);
  const needsAuth = isProtectedPath(router.pathname);

  useEffect(() => {
    if (!loading && needsAuth && !user) {
      // Use window.location instead of router.asPath: on first render before
      // hydration, router.asPath still has unresolved dynamic params like
      // "/courses/[courseId]". window.location.pathname is always the real URL.
      const next = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : router.asPath;
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, needsAuth, user, router]);

  if (needsAuth && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showChrome && (
        <Navbar
          user={user ? { name: user.fullName || "", email: user.email } : undefined}
          onLogout={() => {
            logout();
            router.push("/auth/login");
          }}
        />
      )}
      <main>
        <Component {...pageProps} />
      </main>
    </>
  );
}

export default function App(props: AppProps) {
  // Always provide GoogleOAuthProvider so child hooks never throw during prerender.
  // GoogleButton is itself dynamically imported with ssr:false, so the Google SDK
  // never loads on the server — the clientId fallback below only exists to satisfy
  // the provider's prop type during early client mount.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "missing-client-id";

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ProgressProvider>
          <Head>
            <title>LearnPath AI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
          </Head>
          <Shell {...props} />
        </ProgressProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
