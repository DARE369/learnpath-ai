import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";
import { Icon } from "./icons";
import { navForRoleV2 } from "./nav";
import { color, font } from "./tokens";

function initialsOf(name: string | null | undefined, email: string | undefined): string {
  const source = (name && name.trim()) || email || "";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function planLabel(tier: string | undefined): string {
  if (!tier || tier === "free") return "Free plan";
  return `${tier[0].toUpperCase()}${tier.slice(1)} plan`;
}

function useViewport() {
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { isMobile: width < 720, isTablet: width >= 720 && width < 1080 };
}

function Sidebar({
  isMobile,
  isTablet,
  drawerOpen,
  onCloseDrawer,
}: {
  isMobile: boolean;
  isTablet: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const navItems = navForRoleV2(user?.role);

  const width = isMobile ? 230 : isTablet ? 64 : 220;
  const style: React.CSSProperties = {
    width,
    flexShrink: 0,
    background: color.chromeBg,
    color: color.chromeText,
    padding: isMobile ? "20px 14px" : isTablet ? "20px 8px" : "24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    ...(isMobile
      ? {
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 30,
          transform: `translateX(${drawerOpen ? "0" : "-100%"})`,
          transition: "transform 220ms ease-out",
        }
      : {}),
  };

  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 24px" }}>
        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 19, color: color.chromeText, whiteSpace: "nowrap", overflow: "hidden" }}>
          {isTablet && !isMobile ? "LP" : "LearnPath"}
        </div>
        {isMobile && (
          <button
            onClick={onCloseDrawer}
            aria-label="Close menu"
            style={{ background: "none", border: "none", color: color.chromeText, cursor: "pointer", padding: 4, display: "flex" }}
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      {navItems.map((item) => {
        const active = router.pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 7,
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "none",
              background: active ? color.chromeNavActiveBg : "transparent",
              color: active ? "#fff" : color.chromeNavInactive,
            }}
          >
            <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={item.icon} size={15} className="" />
            </span>
            {(!isTablet || isMobile) && <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>{item.label}</span>}
          </Link>
        );
      })}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderTop: `1px solid ${color.chromeBorder}`, marginTop: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#2B3A67",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
            color: "#fff",
          }}
        >
          {initialsOf(user?.fullName, user?.email)}
        </div>
        {(!isTablet || isMobile) && (
          <div style={{ fontSize: 12, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: color.chromeText }}>{user?.fullName || user?.email || "Learner"}</div>
            <div style={{ opacity: 0.55, color: color.chromeText }}>{planLabel(user?.tier)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Topbar({ isMobile, onOpenDrawer }: { isMobile: boolean; onOpenDrawer: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/paths?q=${encodeURIComponent(q.trim())}&autorun=1`);
  }

  // The topic search box is a learner concept — teachers/school admins get
  // just the mobile menu affordance (or nothing) instead.
  if (user?.role && user.role !== "student" && user.role !== "user") {
    if (!isMobile) return null;
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={onOpenDrawer}
          aria-label="Open menu"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
        >
          <Icon name="menu" size={20} className="" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitSearch}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        border: `1px solid ${color.border}`,
        borderRadius: 8,
        background: color.surface,
        fontSize: 13,
        color: color.textFaint,
        minWidth: 220,
        marginBottom: 20,
        maxWidth: 360,
      }}
    >
      <Icon name="search" size={15} className="" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search paths, concepts…"
        style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontFamily: font.body, width: "100%", color: color.ink }}
      />
    </form>
  );
}

export default function AppShellV2({ children }: { children: React.ReactNode }) {
  const { isMobile, isTablet } = useViewport();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainPadding = isMobile ? "20px 16px 48px" : isTablet ? "28px 24px 48px" : "36px 44px 60px";

  return (
    <div style={{ display: "flex", minHeight: "100vh", color: color.ink, background: color.paper, fontFamily: font.body, position: "relative" }}>
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,23,31,0.45)", zIndex: 20 }} />
      )}
      <Sidebar isMobile={isMobile} isTablet={isTablet} drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, padding: mainPadding, maxWidth: 1180 }}>
        <Topbar isMobile={isMobile} onOpenDrawer={() => setDrawerOpen(true)} />
        {children}
      </div>
    </div>
  );
}
