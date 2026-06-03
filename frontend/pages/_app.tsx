import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Navbar from "../components/Navbar";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ProgressProvider } from "../hooks/useProgress";
import { PWAInstallPrompt } from "../components/PWA/PWAInstallPrompt";
import { OfflineIndicator } from "../components/PWA/OfflineIndicator";
import "../styles/globals.css";

const NO_CHROME_PATHS = ["/", "/auth/login", "/auth/signup", "/auth/forgot-password", "/onboarding"];

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
  const isAdminRoute = router.pathname === "/admin" || router.pathname.startsWith("/admin/");
  const blockedFromAdmin = isAdminRoute && !!user && user.role !== "admin";

  useEffect(() => {
    if (loading) return;

    if (needsAuth && !user) {
      const next = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : router.asPath;
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    // Redirect newly-logged-in users who haven't completed onboarding.
    // Skip if they're already on the onboarding page.
    if (user && !user.onboardingCompleted && router.pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    // Admin-only routes: non-admin users are bounced to their dashboard.
    if (blockedFromAdmin) {
      router.replace("/dashboard");
    }
  }, [loading, needsAuth, user, router, blockedFromAdmin]);

  if ((needsAuth && !user) || blockedFromAdmin) {
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
          isAdmin={user?.role === "admin"}
          onLogout={() => {
            logout();
            router.push("/auth/login");
          }}
        />
      )}
      <main>
        <Component {...pageProps} />
      </main>
      <OfflineIndicator />
      <PWAInstallPrompt />
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
    </GoogleOAuthProvider>
  );
}
