import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { cn } from "../ui/cn";

const COLLAPSE_KEY = "lp_sidebar_collapsed";

interface AppShellProps {
  role?: string;
  children: React.ReactNode;
}

export default function AppShell({ role, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist the collapsed preference across sessions.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={cn("flex min-h-screen flex-col transition-[padding] md:pl-sidebar", collapsed && "md:pl-sidebar-collapsed")}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
