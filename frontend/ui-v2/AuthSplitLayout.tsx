import React, { useEffect, useState } from "react";
import Link from "next/link";
import { color, font } from "./tokens";

function useIsNarrow(breakpoint: number) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return narrow;
}

/**
 * Shared split layout for Sign In / Create Account: a dark brand panel on
 * wide screens, collapsing to a plain form column on narrow ones.
 */
export default function AuthSplitLayout({ brandPanel, children }: { brandPanel: React.ReactNode; children: React.ReactNode }) {
  const isNarrow = useIsNarrow(860);

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "0.9fr 1fr", color: color.ink, background: color.paper, fontFamily: font.body }}>
      {!isNarrow && (
        <div style={{ background: color.chromeBg, color: color.chromeText, padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {brandPanel}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: isNarrow ? "40px 20px" : "40px 48px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {isNarrow && (
            <Link href="/" style={{ textDecoration: "none", fontFamily: font.display, fontWeight: 600, fontSize: 19, color: color.ink, display: "inline-block", marginBottom: 28 }}>
              LearnPath
            </Link>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
