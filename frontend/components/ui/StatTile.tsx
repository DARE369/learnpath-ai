import React from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "./cn";
import { Card } from "./Card";

type Color = "accent" | "success" | "warning" | "info";

const ICON_BG: Record<Color, string> = {
  accent: "bg-accent-muted text-accent-light",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  info: "bg-info-muted text-info",
};

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color?: Color;
  trend?: "up" | "down" | "flat";
  delta?: string;
  href?: string;
  onClick?: () => void;
}

export function StatTile({ icon, label, value, color = "accent", trend, delta, href, onClick }: StatTileProps) {
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-white/40";
  const isInteractive = !!(href || onClick);

  const inner = (
    <Card
      padding="md"
      className={cn(isInteractive && "cursor-pointer hover:bg-white/[0.07] hover:border-white/10 transition-colors")}
    >
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", ICON_BG[color])}>
          {icon}
        </div>
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
      </div>
      <p className="mt-4 text-[32px] leading-none font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{label}</p>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}
