import React from "react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  rarity?: "common" | "rare" | "epic" | "legendary";
}

const rarityConfig = {
  common: { border: "border-white/10", glow: "", label: "" },
  rare: { border: "border-blue-500/30", glow: "shadow-blue-500/20", label: "Rare" },
  epic: { border: "border-indigo-500/40", glow: "shadow-indigo-500/25", label: "Epic" },
  legendary: { border: "border-amber-500/40", glow: "shadow-amber-500/25", label: "Legendary" },
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const unlocked = !!achievement.unlockedAt;
  const rarity = achievement.rarity ?? "common";
  const rc = rarityConfig[rarity];

  return (
    <div
      className={`relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 text-center group
        ${unlocked
          ? `bg-white/[0.03] ${rc.border} hover:bg-white/[0.06] shadow-lg ${rc.glow}`
          : "bg-white/[0.02] border-white/[0.06] opacity-50"
        }`}
    >
      {/* Rarity label */}
      {unlocked && rarity !== "common" && (
        <span
          className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full
            ${rarity === "legendary" ? "text-amber-400 bg-amber-500/10" : rarity === "epic" ? "text-indigo-400 bg-indigo-500/10" : "text-blue-400 bg-blue-500/10"}`}
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

      {/* Progress bar for locked achievements */}
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
      {unlocked && achievement.unlockedAt && (
        <p className="text-[10px] text-white/20 mt-2">
          {new Date(achievement.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}

export default function AchievementBadges({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);

  return (
    <div>
      {unlocked.length > 0 && (
        <>
          <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">
            Unlocked · {unlocked.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {unlocked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </>
      )}
      {locked.length > 0 && (
        <>
          <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">
            In Progress · {locked.length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {locked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </>
      )}
    </div>
  );
}
