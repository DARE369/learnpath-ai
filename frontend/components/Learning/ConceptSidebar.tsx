import React, { useState } from "react";

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

const STATUS_CONFIG = {
  mastered: {
    label: "Mastered",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  learning: {
    label: "Learning",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    dot: "bg-indigo-400",
  },
  not_started: {
    label: "New",
    color: "text-white/30",
    bg: "bg-white/5",
    border: "border-white/10",
    dot: "bg-white/20",
  },
};

function MasteryBar({ mastery = 0 }: { mastery?: number }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${mastery}%`,
            background:
              mastery >= 80
                ? "linear-gradient(90deg, #10b981, #34d399)"
                : mastery >= 40
                ? "linear-gradient(90deg, #6366f1, #818cf8)"
                : "rgba(255,255,255,0.2)",
          }}
        />
      </div>
      <span className="text-xs text-white/30 tabular-nums w-8 text-right">{mastery}%</span>
    </div>
  );
}

type Tab = "concepts" | "notes";

export default function ConceptSidebar({
  concepts,
  videoTitle,
  notes = "",
  onNotesChange,
}: ConceptSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("concepts");
  const [expanded, setExpanded] = useState<string | null>(null);

  const masteredCount = concepts.filter((c) => c.status === "mastered").length;
  const learningCount = concepts.filter((c) => c.status === "learning").length;

  return (
    <div className="flex flex-col h-full bg-[#1c1c1c] rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">
          {videoTitle ? "Key Concepts" : "Concepts & Notes"}
        </h3>
        {concepts.length > 0 && (
          <div className="flex items-center gap-3 mt-1.5">
            {masteredCount > 0 && (
              <span className="text-xs text-emerald-400">
                {masteredCount} mastered
              </span>
            )}
            {learningCount > 0 && (
              <span className="text-xs text-indigo-400">
                {learningCount} learning
              </span>
            )}
            {masteredCount === 0 && learningCount === 0 && (
              <span className="text-xs text-white/30">{concepts.length} concepts</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {(["concepts", "notes"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "concepts" ? (
          <div className="p-3 space-y-1.5">
            {concepts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm text-center">
                  Concepts will appear<br />as you watch the video
                </p>
              </div>
            ) : (
              concepts.map((concept) => {
                const cfg = STATUS_CONFIG[concept.status ?? "not_started"];
                const isOpen = expanded === concept.name;

                return (
                  <div
                    key={concept.name}
                    className={`rounded-xl border transition-all duration-200 ${cfg.bg} ${cfg.border}`}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : concept.name)}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
                    >
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white/80 leading-tight">{concept.name}</span>
                          <span className={`text-xs flex-shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {concept.mastery !== undefined && (
                          <MasteryBar mastery={concept.mastery} />
                        )}
                      </div>
                      {concept.description && (
                        <svg
                          className={`w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    {isOpen && concept.description && (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-white/40 leading-relaxed border-t border-white/[0.06] pt-2">
                          {concept.description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="p-3 h-full flex flex-col">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder="Add your notes here… press space to start typing"
              className="flex-1 w-full bg-transparent text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none leading-relaxed"
              style={{ minHeight: 200 }}
            />
            {notes && (
              <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-white/20">{notes.length} chars</span>
                <button
                  onClick={() => onNotesChange?.("")}
                  className="text-xs text-white/20 hover:text-white/50 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
