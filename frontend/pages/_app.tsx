import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Navbar from "../components/Navbar";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ProgressProvider } from "../hooks/useProgress";
import "../styles/globals.css";

const NO_CHROME_PATHS = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/explore",
  "/courses",
  "/learning",
  "/settings",
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
      router.replace(`/auth/login?next=${encodeURIComponent(router.asPath)}`);
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
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const tree = (
    <AuthProvider>
      <ProgressProvider>
        <Head>
          <title>LearnPath AI</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Shell {...props} />
      </ProgressProvider>
    </AuthProvider>
  );

  if (!googleClientId) return tree;
  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}
