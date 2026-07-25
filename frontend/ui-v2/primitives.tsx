import React from "react";
import Link from "next/link";
import { cn } from "./cn";
import { color, font, radius, DEFAULT_THRESHOLD } from "./tokens";

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({
  className,
  padding = "md",
  dark = false,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  padding?: "sm" | "md" | "lg";
  dark?: boolean;
}) {
  const pad = { sm: "14px 16px", md: "18px 20px", lg: "26px 30px" }[padding];
  return (
    <div
      className={cn("w-full", className)}
      style={{
        background: dark ? color.chromeBg : color.surface,
        border: dark ? "none" : `1px solid ${color.border}`,
        borderRadius: radius.lg,
        padding: pad,
        color: dark ? color.chromeText : undefined,
        ...style,
      }}
      {...rest}
    />
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────

interface ButtonBaseProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

function buttonStyle(variant: ButtonBaseProps["variant"], size: ButtonBaseProps["size"], disabled?: boolean) {
  const base: React.CSSProperties = {
    fontFamily: font.body,
    fontWeight: 600,
    borderRadius: radius.md,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: size === "sm" ? 13 : 14.5,
    padding: size === "sm" ? "8px 14px" : "11px 20px",
    opacity: disabled ? 0.6 : 1,
    border: "1px solid transparent",
  };
  if (variant === "secondary") {
    return { ...base, background: color.surface, borderColor: "#CFCBC0", color: color.ink };
  }
  if (variant === "ghost") {
    return { ...base, background: "transparent", color: color.ink };
  }
  return { ...base, background: "#2B3A67", color: "#fff" };
}

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  fullWidth,
  className,
  children,
  disabled,
  style,
  ...rest
}: ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={className}
      disabled={disabled}
      style={{ ...buttonStyle(variant, size, disabled), width: fullWidth ? "100%" : undefined, ...style }}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  leftIcon,
  fullWidth,
  className,
  children,
  style,
}: ButtonBaseProps & { href: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Link
      href={href}
      className={className}
      style={{ ...buttonStyle(variant, size), textDecoration: "none", width: fullWidth ? "100%" : undefined, ...style }}
    >
      {leftIcon}
      {children}
    </Link>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_TONE_COLOR: Record<BadgeTone, { fg: string; bg: string }> = {
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  info: color.info,
  neutral: { fg: color.textFaint, bg: color.surfaceElevated },
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const c = BADGE_TONE_COLOR[tone];
  return (
    <span
      style={{
        fontFamily: font.mono,
        fontSize: 10.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: radius.full,
        background: c.bg,
        color: c.fg,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ─── ProgressBar ────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  tone = "accent",
  trackColor,
}: {
  value: number;
  tone?: "accent" | BadgeTone;
  trackColor?: string;
}) {
  const fill = tone === "accent" ? "#2B3A67" : BADGE_TONE_COLOR[tone].fg;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 6, background: trackColor ?? color.surfaceElevated, borderRadius: radius.full, overflow: "hidden" }}
    >
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, background: fill, borderRadius: radius.full }} />
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse", className)}
      style={{ background: color.surfaceElevated, borderRadius: radius.lg, ...style }}
    />
  );
}

// ─── StatTile ───────────────────────────────────────────────────────────────

export function StatTile({ value, label, href }: { value: string | number; label: string; href?: string }) {
  const inner = (
    <Card padding="md" style={{ display: "block", textDecoration: "none" }}>
      <div style={{ fontFamily: font.mono, fontSize: 24, fontWeight: 600, color: color.ink }}>{value}</div>
      <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>{label}</div>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

// ─── ThresholdRing (the design system's signature device) ─────────────────
// Every score measured against a pass/fail line — amber below, ink above.

export function ThresholdRing({
  pct,
  threshold = DEFAULT_THRESHOLD,
  size = 56,
  dark = false,
  unknown = false,
  plain = false,
}: {
  pct: number;
  threshold?: number;
  size?: number;
  dark?: boolean;
  unknown?: boolean;
  /** Render as a plain 0-100 progress arc with no pass/fail meaning (no
   * threshold notch, fixed accent fill) — for values like "% of path
   * watched" that have no amber/ink pass line. */
  plain?: boolean;
}) {
  const strokeWidth = size >= 100 ? 10 : size >= 60 ? 6 : 5;
  const r = size / 2 - strokeWidth - (size >= 100 ? 0 : 1);
  const c = 2 * Math.PI * r;
  const trackColor = dark ? "#2A2E3A" : color.surfaceElevated;
  const fillColor = unknown ? trackColor : plain ? (dark ? "#8FA0C7" : "#2B3A67") : pct >= threshold ? (dark ? "#F4F1EA" : color.ink) : color.signalAmber;
  const notchAngle = (threshold / 100) * 360 - 90;
  const cx = size / 2;
  const cy = size / 2;
  const notchX = cx + r * Math.cos((notchAngle * Math.PI) / 180);
  const notchY = cy + r * Math.sin((notchAngle * Math.PI) / 180);
  const textColor = unknown ? color.textFainter : dark ? "#F4F1EA" : color.ink;
  const fontSize = size >= 100 ? 22 : size >= 60 ? 14 : 11;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeDasharray={unknown ? "4 5" : undefined} />
      {!unknown && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {!plain && <circle cx={notchX} cy={notchY} r={size >= 100 ? 4 : 3} fill={dark ? "#8B93AE" : color.textFaint} />}
        </>
      )}
      <text x={cx} y={cy + fontSize / 3} textAnchor="middle" fontFamily={font.mono} fontSize={fontSize} fontWeight={600} fill={textColor}>
        {unknown ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}

// ─── SectionLabel ───────────────────────────────────────────────────────────

export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft }}>{children}</div>
      {action}
    </div>
  );
}

// ─── TextField ──────────────────────────────────────────────────────────────

export const TextField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }>(
  function TextField({ label, error, id, style, ...rest }, ref) {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        <label htmlFor={inputId} style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, display: "block", color: color.ink }}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: font.body,
            border: `1px solid ${error ? color.danger.fg : "#CFCBC0"}`,
            borderRadius: radius.sm,
            background: "#fff",
            outline: "none",
            color: color.ink,
            ...style,
          }}
          {...rest}
        />
        {error && <div style={{ fontSize: 11.5, color: color.danger.fg, marginTop: 5 }}>{error}</div>}
      </div>
    );
  },
);

// ─── FormError (banner) ─────────────────────────────────────────────────────

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: color.danger.bg, border: "1px solid #E7B7AE", borderRadius: radius.sm, padding: "11px 14px", fontSize: 13, color: "#8B4A3E", marginBottom: 16 }}>
      {children}
    </div>
  );
}

// ─── Select ─────────────────────────────────────────────────────────────────

export function Select({
  label,
  style,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const el = (
    <select
      style={{
        padding: "8px 12px",
        fontSize: 13,
        fontFamily: font.body,
        border: "1px solid #CFCBC0",
        borderRadius: radius.sm,
        background: "#fff",
        color: color.ink,
        ...style,
      }}
      {...rest}
    />
  );
  if (!label) return el;
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: color.ink }}>{label}</div>
      {el}
    </div>
  );
}

// ─── Textarea ───────────────────────────────────────────────────────────────

export function Textarea({ style, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      style={{
        width: "100%",
        padding: "10px 12px",
        fontSize: 13.5,
        fontFamily: font.body,
        border: "1px solid #CFCBC0",
        borderRadius: radius.sm,
        background: "#fff",
        color: color.ink,
        resize: "vertical",
        outline: "none",
        ...style,
      }}
      {...rest}
    />
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function Modal({ onClose, children, width = 400, dark = false }: { onClose: () => void; children: React.ReactNode; width?: number; dark?: boolean }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,23,31,0.45)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: dark ? color.chromeBg : "#fff", color: dark ? color.chromeText : undefined, borderRadius: 12, padding: 26, width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ children, danger, dark = false }: { children: React.ReactNode; danger?: boolean; dark?: boolean }) {
  return <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, marginBottom: 12, color: danger ? color.danger.fg : dark ? color.chromeText : color.ink }}>{children}</div>;
}

// ─── Toast ──────────────────────────────────────────────────────────────────

export function Toast({ text }: { text: string }) {
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: color.chromeBg, color: color.chromeText, padding: "12px 20px", borderRadius: 8, fontSize: 13.5, zIndex: 50, boxShadow: "0 8px 24px rgba(20,23,31,0.25)" }}>
      {text}
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "12px 0", cursor: "pointer" }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13.5, fontWeight: 500, margin: 0, color: color.ink }}>{label}</p>
        {description && <p style={{ fontSize: 12, color: color.textFaint, margin: "2px 0 0" }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{ position: "relative", flexShrink: 0, display: "inline-flex", height: 24, width: 44, borderRadius: 100, border: "none", cursor: "pointer", background: checked ? "#2B3A67" : "#D9D5C9" }}
      >
        <span style={{ display: "inline-block", height: 20, width: 20, borderRadius: "50%", background: "#fff", marginTop: 2, transform: `translateX(${checked ? 22 : 2}px)`, transition: "transform 160ms ease-out" }} />
      </button>
    </label>
  );
}

// ─── EmptyState / error inline block ───────────────────────────────────────

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card padding="md" style={{ textAlign: "center", padding: "32px 20px" }}>
      <p style={{ fontSize: 13.5, color: color.inkSoft, marginBottom: onRetry ? 12 : 0 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "8px 16px",
            fontSize: 12.5,
            fontWeight: 600,
            borderRadius: radius.sm,
            border: `1px solid ${color.danger.fg}`,
            background: "#fff",
            color: color.danger.fg,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </Card>
  );
}
