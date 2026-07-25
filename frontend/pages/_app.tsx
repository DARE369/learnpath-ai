import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AppShell from "../components/layout/AppShell";
import AppShellV2 from "../ui-v2/AppShellV2";
import { homeForRole } from "../components/layout/nav";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ProgressProvider } from "../hooks/useProgress";
import { ThemeProvider } from "../hooks/ThemeProvider";
import { PWAProvider } from "../hooks/usePWA";
import { PWAInstallPrompt } from "../components/PWA/PWAInstallPrompt";
import { OfflineIndicator } from "../components/PWA/OfflineIndicator";
import "../styles/globals.css";

// Full-bleed "focus mode" screens render with no persistent nav chrome at
// all (their own self-contained top bar instead) — true for both the
// pre-auth pages and a few distraction-free in-app screens (a timed exam,
// active video playback).
const NO_CHROME_PATHS = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/onboarding", "/legal", "/exams/mock", "/learning", "/school/onboarding"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/explore",
  "/courses",
  "/learning",
  "/settings",
  "/billing",
  "/payment",
  "/referral",
  "/loyalty",
  "/review",
  "/notes",
  "/upload",
  "/content",
  "/concepts",
  "/paths",
  "/exams",
  "/buddies",
  "/achievements",
  "/activity",
  "/admin",
  "/teacher",
  "/school",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function hidesChrome(pathname: string): boolean {
  return NO_CHROME_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isStudentRole(role?: string): boolean {
  return !role || role === "student" || role === "user";
}

// Routes that have been migrated to the new (ui-v2) design system get the
// new shell; everything else keeps the legacy AppShell until its own
// migration lands. Add a route here in the same commit that migrates it.
const V2_PATHS = [
  "/dashboard", "/buddies", "/review", "/concepts", "/exams", "/history", "/rewards",
  "/settings", "/billing", "/notes", "/upload", "/content", "/paths", "/courses", "/explore",
  "/teacher/dashboard", "/teacher/class", "/teacher/students",
  "/school/dashboard", "/school/roster", "/school/billing",
];

function usesV2Shell(pathname: string): boolean {
  return V2_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Which audience-area a path belongs to. Used to keep each role in its workspace.
function startsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

// The redirect (if any) a logged-in user needs based on role vs. the area they're
// visiting. Returns null when the user is allowed where they are.
function roleAreaRedirect(pathname: string, role?: string): string | null {
  const home = homeForRole(role);
  if (startsWith(pathname, "/admin") && role !== "admin") return home;
  if (startsWith(pathname, "/teacher") && !(role === "teacher" || role === "admin")) return home;
  if (startsWith(pathname, "/school") && !(role === "school_admin" || role === "admin")) return home;
  return null;
}

// Auth pages that logged-in users should be bounced away from (Rule 2).
const AUTH_PAGES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function Shell({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { user, loading, sessionExpired } = useAuth();

  const showChrome = !hidesChrome(router.pathname);
  const needsAuth = isProtectedPath(router.pathname);
  // A logged-in user visiting an area that doesn't match their role gets bounced
  // to their own home (e.g. a student hitting /admin, a teacher hitting /school).
  const areaRedirect = user ? roleAreaRedirect(router.pathname, user.role) : null;
  const blockedFromArea = !!areaRedirect && router.pathname !== areaRedirect;

  useEffect(() => {
    if (loading) return;

    // Rule 1: unauthenticated → login, with expiry delay when session expired.
    if (needsAuth && !user) {
      const next = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : router.asPath;
      if (sessionExpired) {
        // Show the expiry screen for 3 s, then redirect.
        const t = setTimeout(() => {
          router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
        }, 3000);
        return () => clearTimeout(t);
      }
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // Rule 2: authenticated user visits auth pages → bounce to their home.
    if (!loading && user && isAuthPage(router.pathname)) {
      router.replace(homeForRole(user.role));
      return;
    }

    // Wrong-area access -> send the user to their role's home.
    if (blockedFromArea && areaRedirect) {
      router.replace(areaRedirect);
      return;
    }

    // Onboarding gate applies to students only (teachers/school admins have their
    // own workspace and skip the learner questionnaire).
    // TEMPORARILY DISABLED — uncomment to re-enable onboarding redirect.
    // if (user && isStudentRole(user.role) && !user.onboardingCompleted && router.pathname !== "/onboarding") {
    //   router.replace("/onboarding");
    // }
  }, [loading, needsAuth, user, router, blockedFromArea, areaRedirect, sessionExpired]);

  if ((needsAuth && !user) || blockedFromArea) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          {sessionExpired ? (
            <>
              <div className="text-4xl mb-4">⏱️</div>
              <p className="text-white font-semibold mb-1">Session expired</p>
              <p className="text-white/50 text-sm">Redirecting to sign in…</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">Loading…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Public / focus pages (landing, auth, onboarding) render full-bleed with no shell.
  if (!showChrome) {
    return (
      <>
        <Component {...pageProps} />
        <OfflineIndicator />
        <PWAInstallPrompt />
      </>
    );
  }

  // Authenticated app pages render inside the role-aware sidebar shell —
  // routes migrated to ui-v2 get the new shell, everything else keeps the
  // legacy one until its own migration lands (see V2_PATHS above).
  if (usesV2Shell(router.pathname)) {
    return (
      <AppShellV2>
        <Component {...pageProps} />
        <OfflineIndicator />
        <PWAInstallPrompt />
      </AppShellV2>
    );
  }

  return (
    <AppShell role={user?.role}>
      <Component {...pageProps} />
      <OfflineIndicator />
      <PWAInstallPrompt />
    </AppShell>
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
      <ThemeProvider>
        <PWAProvider>
          <AuthProvider>
            <ProgressProvider>
              <Head>
            <title>LearnPath AI</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="description" content="AI-powered personalized learning platform" />
            <meta name="theme-color" content="#3b82f6" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            <meta name="apple-mobile-web-app-title" content="LearnPath" />
            <link rel="manifest" href="/manifest.json" />
            <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
            <link rel="icon" type="image/png" href="/icons/icon-192x192.png" />
          </Head>
          <Shell {...props} />
            </ProgressProvider>
          </AuthProvider>
        </PWAProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}
