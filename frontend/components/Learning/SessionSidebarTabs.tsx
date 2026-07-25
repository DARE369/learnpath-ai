import React, { useState } from "react";
import { color, font } from "../../ui-v2/tokens";

type Tab = "mastery" | "lexi";

interface Props {
  masteryContent: React.ReactNode;
  /** Render-prop (not a plain node) so AITutorPanel can receive whether the
   * Lexi tab is currently active, for lazy session-init — see the note
   * below on why the pane itself must still stay mounted regardless. */
  lexiContent: (active: boolean) => React.ReactNode;
}

/**
 * Tab switcher for the Mastery/Lexi sidebar panes. Both panes are kept
 * MOUNTED at all times — visibility toggles via CSS `display`, never
 * conditional rendering. AITutorPanel (Lexi's content) owns its chat
 * history/session state internally; if this ever switches to unmounting the
 * inactive pane (`{tab === "lexi" && lexiContent}`), that state resets on
 * every tab switch and a fresh /api/tutor/session fires each time. Keep the
 * CSS-display approach.
 */
export default function SessionSidebarTabs({ masteryContent, lexiContent }: Props) {
  const [tab, setTab] = useState<Tab>("mastery");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: color.chromeBg, border: `1px solid ${color.chromeBorder}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${color.chromeBorder}`, flexShrink: 0 }}>
        {(["mastery", "lexi"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "10px 0", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize",
              background: "none", border: "none", cursor: "pointer", fontFamily: font.body,
              color: tab === t ? "#6FA0E0" : color.textFainter,
              borderBottom: tab === t ? "2px solid #2B5FA8" : "2px solid transparent",
            }}
          >
            {t === "mastery" ? "Mastery" : "Lexi"}
          </button>
        ))}
      </div>

      <div style={{ display: tab === "mastery" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {masteryContent}
      </div>
      <div style={{ display: tab === "lexi" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {lexiContent(tab === "lexi")}
      </div>
    </div>
  );
}
