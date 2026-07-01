import React, { useState } from "react";
import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

const rarityConfig = {
  common:   { border: "border-white/10",     glow: "",                       label: ""          },
  // Bronze
  uncommon: { border: "border-amber-700/40", glow: "shadow-amber-700/20",    label: "Uncommon"  },
  // Silver
  rare:     { border: "border-slate-400/30", glow: "shadow-slate-400/15",    label: "Rare"      },
  // Gold
  epic:     { border: "border-amber-400/40", glow: "shadow-amber-400/25",    label: "Epic"      },
  // Platinum
  legendary:{ border: "border-violet-400/40",glow: "shadow-violet-400/20",   label: "Legendary" },
};

const rarityBadgeStyle = {
  common:    "text-white/40 bg-white/5",
  uncommon:  "text-amber-700 bg-amber-900/20",
  rare:      "text-slate-300 bg-slate-400/10",
  epic:      "text-amber-400 bg-amber-500/10",
  legendary: "text-violet-400 bg-violet-500/10",
};

// ─── Detail modal ─────────────────────────────────────────────────────────────

function AchievementModal({
  achievement,
  onClose,
}: {
  achievement: Achievement;
  onClose: () => void;
}) {
  const unlocked = !!achievement.unlockedAt;
  const rarity = achievement.rarity ?? "common";
  const rc = rarityConfig[rarity];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={`relative z-10 w-full max-w-sm rounded-2xl border bg-[#141414] p-6 shadow-2xl ${rc.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className="text-6xl mb-4"
            style={{ filter: unlocked ? "none" : "grayscale(1) opacity(0.4)" }}
          >
            {achievement.icon}
          </div>

          {/* Rarity */}
          {rarity !== "common" && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 ${rarityBadgeStyle[rarity]}`}>
              {rc.label}
            </span>
          )}

          <h3 className={`text-lg font-bold ${unlocked ? "text-white" : "text-white/40"}`}>
            {achievement.name}
          </h3>
          <p className="mt-1.5 text-sm text-white/50 leading-relaxed">{achievement.description}</p>

          {/* Status */}
          <div className="mt-4 w-full">
            {unlocked ? (
              <>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Unlocked
                </div>
                {achievement.unlockedAt && !Number.isNaN(new Date(achievement.unlockedAt).getTime()) && (
                  <p className="mt-2 text-xs text-white/25">
                    {new Date(achievement.unlockedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-white/30 mb-2">Progress to unlock</p>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500/60 rounded-full transition-all duration-700"
                    style={{ width: `${achievement.progress ?? 0}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-white/25">{achievement.progress ?? 0}%</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

function AchievementCard({
  achievement,
  onClick,
}: {
  achievement: Achievement;
  onClick: () => void;
}) {
  const unlocked = !!achievement.unlockedAt;
  const rarity = achievement.rarity ?? "common";
  const rc = rarityConfig[rarity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 text-center group w-full
        ${
          unlocked
            ? `bg-white/[0.03] ${rc.border} hover:bg-white/[0.06] shadow-lg ${rc.glow}`
            : "bg-white/[0.02] border-white/[0.06] opacity-50 hover:opacity-70"
        }`}
    >
      {/* Rarity label */}
      {unlocked && rarity !== "common" && (
        <span
          className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${rarityBadgeStyle[rarity]}`}
        >
          {rc.label}
        </span>
      )}

      {/* Icon */}
      <div
        className={`text-3xl mb-3 transition-transform duration-200 ${unlocked ? "group-hover:scale-110" : ""}`}
        style={{ filter: unlocked ? "none" : "grayscale(1)" }}
      >
        {achievement.icon}
      </div>

      <p className={`text-xs font-semibold leading-tight ${unlocked ? "text-white/80" : "text-white/30"}`}>
        {achievement.name}
      </p>
      <p className="text-[11px] text-white/30 mt-1 leading-tight">{achievement.description}</p>

      {/* Progress bar for locked */}
      {!unlocked && achievement.progress !== undefined && (
        <div className="w-full mt-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500/60 rounded-full transition-all duration-700"
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-white/20 mt-1">{achievement.progress}%</p>
        </div>
      )}

      {/* Unlock date */}
      {unlocked && achievement.unlockedAt && !Number.isNaN(new Date(achievement.unlockedAt).getTime()) && (
        <p className="text-[10px] text-white/20 mt-2">
          {new Date(achievement.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </button>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface AchievementBadgesProps {
  achievements: Achievement[];
  showViewAll?: boolean;
}

export default function AchievementBadges({ achievements, showViewAll = false }: AchievementBadgesProps) {
  const [selected, setSelected] = useState<Achievement | null>(null);

  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);

  return (
    <>
      {/* Modal */}
      {selected && (
        <AchievementModal achievement={selected} onClose={() => setSelected(null)} />
      )}

      <div>
        {unlocked.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider">
                Unlocked · {unlocked.length}
              </p>
              {showViewAll && (
                <Link
                  href="/achievements"
                  className="inline-flex items-center gap-1 text-xs text-accent-light hover:text-white transition-colors"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {unlocked.map((a) => (
                <AchievementCard key={a.id} achievement={a} onClick={() => setSelected(a)} />
              ))}
            </div>
          </>
        )}
        {locked.length > 0 && (
          <>
            <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">
              In Progress · {locked.length}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {locked.map((a) => (
                <AchievementCard key={a.id} achievement={a} onClick={() => setSelected(a)} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
