/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Colors are driven by CSS variables (see globals.css :root / .dark) so the
      // whole UI flips between light and dark. `white` is intentionally remapped to
      // the foreground token so the app's pervasive `text-white/NN` adapts too.
      colors: {
        white: "rgb(var(--fg) / <alpha-value>)",
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-elevated": "rgb(var(--surface-elevated) / <alpha-value>)",
        "surface-hover": "rgb(var(--surface-hover) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-focus": "rgb(var(--accent) / 0.6)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          light: "rgb(var(--accent-light) / <alpha-value>)",
          muted: "rgb(var(--accent) / 0.15)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        "success-muted": "rgb(var(--success) / 0.15)",
        error: "rgb(var(--error) / <alpha-value>)",
        "error-muted": "rgb(var(--error) / 0.15)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "warning-muted": "rgb(var(--warning) / 0.15)",
        info: "rgb(var(--info) / <alpha-value>)",
        "info-muted": "rgb(var(--info) / 0.15)",
        // Always-white text for content sitting on a coloured (accent/error) fill,
        // so it stays legible regardless of theme (unlike remapped `white`).
        onaccent: "#ffffff",
      },
      spacing: {
        sidebar: "16rem",
        "sidebar-collapsed": "4.5rem",
        topbar: "3.5rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        "gradient-accent-hover": "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        "gradient-surface": "linear-gradient(180deg, #141414 0%, #0f0f0f 100%)",
        "gradient-glow": "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)",
      },
      boxShadow: {
        "glow-accent": "0 0 30px rgba(99,102,241,0.25)",
        "glow-sm": "0 0 15px rgba(99,102,241,0.15)",
        card: "0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)",
        input: "0 0 0 3px rgba(99,102,241,0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
