/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#141414",
        "surface-elevated": "#1c1c1c",
        "surface-hover": "#222222",
        border: "rgba(255,255,255,0.08)",
        "border-focus": "rgba(99,102,241,0.6)",
        accent: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          light: "#818cf8",
          muted: "rgba(99,102,241,0.15)",
        },
        success: "#10b981",
        "success-muted": "rgba(16,185,129,0.15)",
        error: "#ef4444",
        "error-muted": "rgba(239,68,68,0.15)",
        warning: "#f59e0b",
        "warning-muted": "rgba(245,158,11,0.15)",
        info: "#38bdf8",
        "info-muted": "rgba(56,189,248,0.15)",
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
