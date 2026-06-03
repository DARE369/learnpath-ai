import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { LanguageSwitcher } from "./i18n/LanguageSwitcher";

interface NavbarUser {
  name: string;
  email: string;
}

interface NavbarProps {
  user?: NavbarUser;
  isAdmin?: boolean;
  onLogout?: () => void;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/upload", label: "Upload" },
  { href: "/notes", label: "Notes" },
  { href: "/concepts", label: "Concepts" },
  { href: "/review", label: "Review" },
  { href: "/referral", label: "Referral" },
  { href: "/loyalty", label: "Loyalty" },
  { href: "/settings", label: "Settings" },
];

const ADMIN_LINK = { href: "/admin", label: "Admin" };

function initials(name?: string, email?: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Navbar({ user, isAdmin, onLogout }: NavbarProps) {
  const navLinks = isAdmin ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [router.pathname]);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return router.pathname === "/dashboard";
    return router.pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">LearnPath AI</span>
          </Link>

          {/* Desktop nav links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-white bg-surface-elevated"
                      : "text-white/60 hover:text-white hover:bg-surface-elevated/60"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user ? (
              <>
                {/* Mobile menu toggle */}
                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-surface-elevated transition-colors"
                  aria-label="Toggle menu"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {mobileOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>

                {/* User menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-surface-elevated transition-colors"
                    aria-label="User menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center text-white text-xs font-semibold shadow-glow-sm">
                      {initials(user.name, user.email)}
                    </div>
                    <span className="hidden sm:block text-sm text-white/80 max-w-[140px] truncate">
                      {user.name || user.email}
                    </span>
                    <svg className="w-4 h-4 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface-elevated border border-border shadow-card overflow-hidden animate-fade-in">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-medium text-white truncate">{user.name || "Signed in"}</p>
                        <p className="text-xs text-white/40 truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/referral"
                          className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-surface-hover transition-colors"
                        >
                          Refer a friend
                        </Link>
                        <Link
                          href="/loyalty"
                          className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-surface-hover transition-colors"
                        >
                          Loyalty rewards
                        </Link>
                        <Link
                          href="/billing"
                          className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-surface-hover transition-colors"
                        >
                          Billing &amp; plan
                        </Link>
                        <Link
                          href="/settings"
                          className="block px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-surface-hover transition-colors"
                        >
                          Account settings
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onLogout?.();
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-error/90 hover:text-error hover:bg-surface-hover transition-colors"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-accent shadow-glow-sm hover:opacity-90 transition-opacity"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && mobileOpen && (
          <div className="md:hidden pb-3 animate-fade-in">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-white bg-surface-elevated"
                      : "text-white/60 hover:text-white hover:bg-surface-elevated/60"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
