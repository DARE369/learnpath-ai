import React from "react";

interface DayActivity {
  date: string;
  minutes: number;
  videos: number;
}

interface ActivityHeatmapProps {
  data: DayActivity[];
  weeks?: number;
}

function getIntensity(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

const intensityStyles = [
  "bg-white/[0.04] border-white/[0.06]",          // 0 — none
  "bg-indigo-900/60 border-indigo-800/40",          // 1 — light
  "bg-indigo-700/60 border-indigo-600/40",          // 2 — moderate
  "bg-indigo-500/70 border-indigo-400/40",          // 3 — active
  "bg-indigo-400/90 border-indigo-300/50",          // 4 — very active
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildGrid(data: DayActivity[], weeks: number): (DayActivity | null)[][] {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const today = new Date();
  const totalDays = weeks * 7;

  const grid: (DayActivity | null)[][] = Array.from({ length: 7 }, () =>
    new Array(weeks).fill(null)
  );

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (totalDays - 1 - i));
    const key = d.toISOString().split("T")[0];
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday=0
    const weekCol = Math.floor(i / 7);
    grid[dayOfWeek][weekCol] = dataMap.get(key) ?? { date: key, minutes: 0, videos: 0 };
  }

  return grid;
}

function getMonthLabels(weeks: number): { label: string; col: number }[] {
  const labels: { label: string; col: number }[] = [];
  const today = new Date();
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (weeks - 1 - w) * 7);
    if (d.getMonth() !== lastMonth) {
      labels.push({ label: MONTHS[d.getMonth()], col: w });
      lastMonth = d.getMonth();
    }
  }
  return labels;
}

export default function ActivityHeatmap({ data, weeks = 16 }: ActivityHeatmapProps) {
  const grid = buildGrid(data, weeks);
  const monthLabels = getMonthLabels(weeks);
  const [tooltip, setTooltip] = React.useState<{ text: string; x: number; y: number } | null>(null);

  const cellSize = 14;
  const gap = 3;

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Activity Heatmap</h3>
          <p className="text-xs text-white/30 mt-0.5">
            {data.filter((d) => d.minutes > 0).length} active days in the last {weeks} weeks
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-white/30">Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm border ${intensityStyles[i]}`}
            />
          ))}
          <span className="text-[11px] text-white/30">More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: weeks * (cellSize + gap) + 32 }}>
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {monthLabels.map(({ label, col }) => (
              <div
                key={`${label}-${col}`}
                className="text-[10px] text-white/30 absolute"
                style={{ left: 32 + col * (cellSize + gap) }}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="h-4" />

          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col mr-2" style={{ gap }}>
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className="text-[10px] text-white/25 flex items-center"
                  style={{ height: cellSize, opacity: i % 2 === 0 ? 1 : 0 }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="flex" style={{ gap }}>
              {Array.from({ length: weeks }).map((_, w) => (
                <div key={w} className="flex flex-col" style={{ gap }}>
                  {grid.map((row, d) => {
                    const cell = row[w];
                    if (!cell) {
                      return (
                        <div
                          key={d}
                          className="rounded-sm opacity-0"
                          style={{ width: cellSize, height: cellSize }}
                        />
                      );
                    }
                    const intensity = getIntensity(cell.minutes);
                    return (
                      <div
                        key={d}
                        className={`rounded-sm border cursor-default transition-opacity hover:opacity-80 ${intensityStyles[intensity]}`}
                        style={{ width: cellSize, height: cellSize }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            text: cell.minutes > 0
                              ? `${cell.date}: ${cell.minutes}m · ${cell.videos} video${cell.videos !== 1 ? "s" : ""}`
                              : `${cell.date}: No activity`,
                            x: rect.left,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[#1c1c1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 18, top: tooltip.y - 10 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
