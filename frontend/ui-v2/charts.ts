/**
 * Chart color conventions for ui-v2's (rare) recharts usage — TopicsChart and
 * ProgressChart are the only consumers. Keep this light-theme-safe; ui-v2
 * has no dark chart context today.
 */
import { color } from "./tokens";

export const chartColor = {
  categorical: [color.ink, "#8B93AE", color.surfaceElevated] as const,
  accentLine: "#2B3A67",
  successLine: color.success.fg,
  grid: color.borderMuted,
  tickText: color.textFaint,
  tooltipBg: color.surface,
  tooltipBorder: color.border,
  // 5-step sequential scale for the activity heatmap (light → dark, ink-based).
  heatmapScale: [color.surfaceElevated, "#D9D5C9", "#8B93AE", "#4A5163", color.ink] as const,
} as const;
