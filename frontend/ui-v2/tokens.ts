/**
 * ui-v2 design tokens — mirrors `Design System.dc.html` from the July 2026
 * Claude Design handoff. This is the single source of truth for ui-v2's
 * visual values. Do not import anything from the legacy `lib/tokens.ts` or
 * `components/ui/*` into this file or anything under `ui-v2/`.
 */

export const color = {
  ink: "#14171F",
  inkSoft: "#4A5163",
  paper: "#FAF8F4",
  signalAmber: "#C8792A", // Threshold Ring only — never decoration

  success: { fg: "#1E7F5C", bg: "#E7F3EE" },
  warning: { fg: "#A66A0A", bg: "#FBF0DD" },
  danger: { fg: "#B0362C", bg: "#FBEAE7" },
  info: { fg: "#2B5FA8", bg: "#E9F0FA" },

  surface: "#FFFFFF",
  surfaceElevated: "#F0EEE7",
  surfaceMuted: "#F7F5F0",
  border: "#E4E1D8",
  borderMuted: "#F0EEE7",

  // dark chrome (sidebar/hero cards)
  chromeBg: "#14171F",
  chromeBorder: "#2A2E3A",
  chromeText: "#F4F1EA",
  chromeTextMuted: "#B8BFCF",
  chromeTextFaint: "#8FA0C7",
  chromeNavInactive: "#B8B5AB",
  chromeNavActiveBg: "#232838",

  textFaint: "#8B8577",
  textFainter: "#B0AC9F",
} as const;

export const font = {
  display: "'Newsreader', serif", // page titles / section headers only
  body: "'Hanken Grotesk', sans-serif", // every UI label, body copy, control
  mono: "'IBM Plex Mono', monospace", // scores, IDs, timestamps, currency
} as const;

export const typeScale = {
  display: { family: font.display, weight: 600, size: "40px", lineHeight: 1.15 },
  h1: { family: font.display, weight: 600, size: "28px", lineHeight: 1.2 },
  h2: { family: font.display, weight: 500, size: "20px", lineHeight: 1.3 },
  bodyLg: { family: font.body, weight: 500, size: "16px", lineHeight: 1.5 },
  body: { family: font.body, weight: 400, size: "14px", lineHeight: 1.55 },
  data: { family: font.mono, weight: 500, size: "13px", lineHeight: 1.4 },
} as const;

// 4px base scale
export const space = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  full: "100px",
} as const;

// 70% is the default pass/fail line for the Threshold Ring and any bare
// percentage that represents mastery/readiness/health without its own
// explicit threshold.
export const DEFAULT_THRESHOLD = 70;

// Motion: 140–180ms ease-out for hovers/toggles, 220ms for panels/modals.
// No motion on data refresh — numbers update in place.
export const motion = {
  fast: "160ms ease-out",
  panel: "220ms ease-out",
} as const;
