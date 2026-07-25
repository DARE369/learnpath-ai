// Orphaned by the ui-v2 Dashboard migration — re-homed on the History page's
// Activity tab, above the flat activity list.
import React from "react";
import { Card } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";
import { chartColor } from "../../ui-v2/charts";

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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildGrid(data: DayActivity[], weeks: number): (DayActivity | null)[][] {
  const dataMap = new Map(data.map((d) => [d.date, d]));
  const today = new Date();
  const totalDays = weeks * 7;

  const grid: (DayActivity | null)[][] = Array.from({ length: 7 }, () => new Array(weeks).fill(null));

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
    <Card padding="md" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>Activity Heatmap</div>
          <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>
            {data.filter((d) => d.minutes > 0).length} active days in the last {weeks} weeks
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: color.textFaint }}>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: 3, border: `1px solid ${color.border}`, background: chartColor.heatmapScale[i] }} />
          ))}
          <span style={{ fontSize: 11, color: color.textFaint }}>More</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", minWidth: weeks * (cellSize + gap) + 32 }}>
          <div style={{ display: "flex", marginBottom: 4, marginLeft: 32, position: "relative", height: 14 }}>
            {monthLabels.map(({ label, col }) => (
              <div key={`${label}-${col}`} style={{ fontSize: 10, color: color.textFaint, position: "absolute", left: col * (cellSize + gap) }}>
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column", marginRight: 8, gap }}>
              {DAYS.map((day, i) => (
                <div key={day} style={{ fontSize: 10, color: color.textFainter, display: "flex", alignItems: "center", height: cellSize, opacity: i % 2 === 0 ? 1 : 0 }}>
                  {day}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap }}>
              {Array.from({ length: weeks }).map((_, w) => (
                <div key={w} style={{ display: "flex", flexDirection: "column", gap }}>
                  {grid.map((row, d) => {
                    const cell = row[w];
                    if (!cell) return <div key={d} style={{ width: cellSize, height: cellSize, opacity: 0 }} />;
                    const intensity = getIntensity(cell.minutes);
                    return (
                      <div
                        key={d}
                        style={{ width: cellSize, height: cellSize, borderRadius: 3, border: `1px solid ${color.border}`, background: chartColor.heatmapScale[intensity], cursor: "default" }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            text: cell.minutes > 0 ? `${cell.date}: ${cell.minutes}m · ${cell.videos} video${cell.videos !== 1 ? "s" : ""}` : `${cell.date}: No activity`,
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

      {tooltip && (
        <div style={{ position: "fixed", zIndex: 50, left: tooltip.x + 18, top: tooltip.y - 10, background: color.chromeBg, color: color.chromeText, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: font.body, pointerEvents: "none", boxShadow: "0 8px 24px rgba(20,23,31,0.25)" }}>
          {tooltip.text}
        </div>
      )}
    </Card>
  );
}
