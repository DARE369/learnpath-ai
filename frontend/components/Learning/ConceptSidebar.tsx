import React, { useState } from "react";
import { ProgressBar, Textarea, type BadgeTone } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

interface Concept {
  name: string;
  mastery?: number;
  status?: "not_started" | "learning" | "mastered";
  description?: string;
}

interface ConceptSidebarProps {
  concepts: Concept[];
  videoTitle?: string;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

const STATUS_CONFIG: Record<NonNullable<Concept["status"]>, { label: string; fg: string; tone: BadgeTone }> = {
  mastered: { label: "Mastered", fg: "#5FCFA0", tone: "success" },
  learning: { label: "Learning", fg: "#6FA0E0", tone: "info" },
  not_started: { label: "New", fg: color.textFainter, tone: "neutral" },
};

export default function ConceptSidebar({ concepts, videoTitle, notes = "", onNotesChange }: ConceptSidebarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const masteredCount = concepts.filter((c) => c.status === "mastered").length;
  const learningCount = concepts.filter((c) => c.status === "learning").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontFamily: font.body }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${color.chromeBorder}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: color.chromeText }}>{videoTitle ? "Key Concepts" : "Concepts"}</div>
        {concepts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            {masteredCount > 0 && <span style={{ fontSize: 11.5, color: "#5FCFA0" }}>{masteredCount} mastered</span>}
            {learningCount > 0 && <span style={{ fontSize: 11.5, color: "#6FA0E0" }}>{learningCount} learning</span>}
            {masteredCount === 0 && learningCount === 0 && <span style={{ fontSize: 11.5, color: color.textFainter }}>{concepts.length} concepts</span>}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {concepts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: color.textFainter }}>
              <Icon name="sparkles" size={18} className="" />
            </div>
            <p style={{ color: color.textFainter, fontSize: 13, textAlign: "center", margin: 0, lineHeight: 1.5 }}>Concepts will appear<br />as you watch the video</p>
          </div>
        ) : (
          concepts.map((concept) => {
            const cfg = STATUS_CONFIG[concept.status ?? "not_started"];
            const isOpen = expanded === concept.name;
            return (
              <div key={concept.name} style={{ borderRadius: 10, border: `1px solid ${color.chromeBorder}`, background: "rgba(255,255,255,0.02)" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : concept.name)}
                  style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: font.body }}
                >
                  <span style={{ marginTop: 6, width: 6, height: 6, borderRadius: "50%", background: cfg.fg, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, color: color.chromeTextMuted, lineHeight: 1.3 }}>{concept.name}</span>
                      <span style={{ fontSize: 11, color: cfg.fg, flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                    {concept.mastery !== undefined && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <div style={{ flex: 1 }}><ProgressBar value={concept.mastery} tone={cfg.tone} trackColor="rgba(255,255,255,0.1)" /></div>
                        <span style={{ fontSize: 11, color: color.textFainter, width: 32, textAlign: "right" }}>{concept.mastery}%</span>
                      </div>
                    )}
                  </div>
                  {concept.description && <Icon name="chevronDown" size={14} className="" />}
                </button>
                {isOpen && concept.description && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <p style={{ fontSize: 11.5, color: color.textFainter, lineHeight: 1.5, borderTop: `1px solid ${color.chromeBorder}`, paddingTop: 8, margin: 0 }}>{concept.description}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ borderTop: `1px solid ${color.chromeBorder}`, padding: 12, flexShrink: 0 }}>
        <button onClick={() => setNotesOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font.body }}>
          <Icon name="pencil" size={13} className="" />
          <span style={{ fontSize: 12, fontWeight: 600, color: color.chromeTextMuted }}>Notes</span>
          <span style={{ marginLeft: "auto", color: color.textFainter, transform: notesOpen ? "rotate(180deg)" : undefined, display: "flex" }}>
            <Icon name="chevronDown" size={14} className="" />
          </span>
        </button>
        {notesOpen && (
          <div style={{ marginTop: 10 }}>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder="Add your notes here…"
              rows={5}
              style={{ background: "rgba(0,0,0,0.3)", borderColor: color.chromeBorder, color: color.chromeText }}
            />
            {notes && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: color.textFainter }}>{notes.length} chars</span>
                <button onClick={() => onNotesChange?.("")} style={{ fontSize: 11, color: color.textFainter, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
