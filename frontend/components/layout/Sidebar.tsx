import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { PanelLeftClose, PanelLeft, X } from "lucide-react";
import { cn } from "../ui/cn";
import { navForRole } from "./nav";

interface SidebarProps {
  role?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/admin" || href === "/teacher/dashboard" || href === "/school/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ role, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const router = useRouter();
  const groups = navForRole(role);

  const inner = (showLabels: boolean) => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn("flex h-topbar items-center gap-2.5 px-4", !showLabels && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-accent shadow-glow-sm">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {showLabels && <span className="text-sm font-semibold tracking-tight text-white">LearnPath AI</span>}
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            {showLabels && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(router.pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={!showLabels ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      !showLabels && "justify-center px-0",
                      active
                        ? "bg-accent-muted text-accent-light"
                        : "text-white/55 hover:bg-surface-elevated hover:text-white",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                    {showLabels && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden border-t border-border p-3 md:block">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/45 transition-colors hover:bg-surface-elevated hover:text-white",
            !showLabels && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {showLabels && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface md:block",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        {inner(!collapsed)}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={onCloseMobile}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-sidebar border-r border-border bg-surface transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/50 hover:bg-surface-elevated hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          {inner(true)}
        </aside>
      </div>
    </>
  );
}
