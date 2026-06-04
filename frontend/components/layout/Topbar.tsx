import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Menu, Search, Flame, ChevronDown, Settings, CreditCard, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { cn } from "../ui/cn";
import { useAuth } from "../../hooks/useAuth";
import { useProgress } from "../../hooks/useProgress";
import { useTheme, type Theme } from "../../hooks/ThemeProvider";

interface TopbarProps {
  onOpenMobile: () => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Topbar({ onOpenMobile }: TopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { streak } = useProgress();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cycle light -> dark -> system. Icon reflects the current preference.
  const THEME_ORDER: Theme[] = ["light", "dark", "system"];
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const cycleTheme = () => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const firstName = (user?.fullName || user?.email || "").split(/[\s@]/)[0];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/explore?q=${encodeURIComponent(q)}&autorun=1`);
    setQuery("");
  }

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="rounded-lg p-1.5 text-white/60 hover:bg-surface-elevated hover:text-white md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Greeting */}
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium text-white">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </p>
      </div>

      {/* Global search — entry to the learning loop from anywhere */}
      <form onSubmit={submitSearch} className="relative ml-auto w-full max-w-xs sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Learn something new…"
          aria-label="Search topics"
          className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-accent/50 focus:outline-none"
        />
      </form>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={`Theme: ${theme} (click to change)`}
        title={`Theme: ${theme}`}
        className="rounded-lg p-2 text-white/60 transition-colors hover:bg-surface-elevated hover:text-white"
      >
        <ThemeIcon className="h-[18px] w-[18px]" />
      </button>

      {/* Streak chip */}
      <Link
        href="/dashboard"
        className="hidden items-center gap-1.5 rounded-lg border border-warning/20 bg-warning-muted px-2.5 py-1.5 sm:flex"
        title={`${streak}-day streak`}
      >
        <Flame className="h-4 w-4 text-warning" />
        <span className="text-sm font-semibold tabular-nums text-warning">{streak}</span>
      </Link>

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-surface-elevated"
          aria-label="Account menu"
        >
          <Avatar name={user?.fullName} email={user?.email} size="sm" />
          <ChevronDown className="hidden h-4 w-4 text-white/40 sm:block" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-card">
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium text-white">{user?.fullName || "Signed in"}</p>
              <p className="truncate text-xs text-white/40">{user?.email}</p>
            </div>
            <div className="py-1">
              <MenuLink href="/settings" icon={<Settings className="h-4 w-4" />} label="Account settings" onClick={() => setMenuOpen(false)} />
              <MenuLink href="/billing" icon={<CreditCard className="h-4 w-4" />} label="Billing & plan" onClick={() => setMenuOpen(false)} />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  router.push("/auth/login");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-error/90 transition-colors hover:bg-surface-hover hover:text-error"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn("flex items-center gap-2.5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-surface-hover hover:text-white")}
    >
      {icon}
      {label}
    </Link>
  );
}
