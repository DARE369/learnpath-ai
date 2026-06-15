/**
 * LearnPath AI Design Tokens
 *
 * Single source of truth for all visual decisions.
 * Use Tailwind classes (which reference CSS variables via tailwind.config.js)
 * for most styling.  Import these constants only for dynamic inline styles,
 * canvas drawing, or third-party library theming that can't use Tailwind.
 *
 * The CSS variables themselves live in globals.css :root / .dark.
 */

export const tokens = {
  // ── Colors ───────────────────────────────────────────────────────────────
  color: {
    // Backgrounds — map to CSS vars used in tailwind.config.js
    bgPrimary:    "#0f0f0f",          // --bg      (body background)
    bgSecondary:  "#171717",          // --surface (cards, panels)
    bgTertiary:   "#1f1f1f",          // --surface-elevated (inputs, hover)
    bgOverlay:    "rgba(0,0,0,0.6)",  // modal backdrop

    // Brand accent — indigo-500
    accent:       "#6366f1",          // --accent
    accentHover:  "#818cf8",          // --accent-hover (indigo-400)
    accentMuted:  "rgba(99,102,241,0.15)", // accent/15

    // Text
    textPrimary:   "#f5f5f5",         // --fg
    textSecondary: "#a3a3a3",         // neutral-400
    textMuted:     "#737373",         // neutral-500
    textInverse:   "#0f0f0f",         // text on accent fills

    // Semantic
    success:      "#22c55e",          // --success (green-500)
    successMuted: "rgba(34,197,94,0.15)",
    error:        "#ef4444",          // --error (red-500)
    errorMuted:   "rgba(239,68,68,0.15)",
    warning:      "#f59e0b",          // --warning (amber-500)
    warningMuted: "rgba(245,158,11,0.15)",

    // Borders
    border:       "#262626",          // --border (neutral-800)
    borderHover:  "#404040",          // neutral-700
    borderFocus:  "#6366f1",          // accent — matches tailwind border-focus
  },

  // ── Typography ───────────────────────────────────────────────────────────
  font: {
    family: "'Inter', system-ui, sans-serif",
    size: {
      xs:   "0.75rem",    // 12px — metadata, timestamps
      sm:   "0.875rem",   // 14px — secondary labels
      base: "1rem",       // 16px — body text
      lg:   "1.125rem",   // 18px — subheadings
      xl:   "1.5rem",     // 24px — section headings
      "2xl": "2rem",      // 32px — page titles
    },
    weight: {
      normal:   "400",
      medium:   "500",
      semibold: "600",
      bold:     "700",
    },
    lineHeight: {
      tight:   "1.25",
      normal:  "1.5",
      relaxed: "1.75",
    },
  },

  // ── Spacing (4 px base unit) ─────────────────────────────────────────────
  space: {
    "1":  "0.25rem",  //  4px
    "2":  "0.5rem",   //  8px
    "3":  "0.75rem",  // 12px
    "4":  "1rem",     // 16px
    "6":  "1.5rem",   // 24px
    "8":  "2rem",     // 32px
    "12": "3rem",     // 48px
    "16": "4rem",     // 64px
  },

  // ── Border radii ─────────────────────────────────────────────────────────
  radius: {
    sm:   "0.375rem",  //  6px — badges, tags
    md:   "0.5rem",    //  8px — buttons, inputs
    lg:   "0.75rem",   // 12px — cards
    xl:   "1rem",      // 16px — modals
    "2xl":"1.5rem",    // 24px — video player
    full: "9999px",    // pills, avatars
  },

  // ── Shadows ──────────────────────────────────────────────────────────────
  shadow: {
    sm:   "0 1px 2px rgba(0,0,0,0.3)",
    md:   "0 4px 12px rgba(0,0,0,0.4)",
    lg:   "0 8px 24px rgba(0,0,0,0.5)",
    glow: "0 0 20px rgba(99,102,241,0.15)",
  },

  // ── Transitions ──────────────────────────────────────────────────────────
  transition: {
    fast:   "150ms ease",
    normal: "200ms ease",
    slow:   "300ms ease-out",
  },

  // ── Breakpoints ──────────────────────────────────────────────────────────
  breakpoint: {
    sm:  "640px",
    md:  "768px",
    lg:  "1024px",
    xl:  "1280px",
    "2xl": "1536px",
  },
} as const;
