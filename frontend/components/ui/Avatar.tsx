import React from "react";
import { cn } from "./cn";

function initials(name?: string | null, email?: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const SIZES = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" } as const;

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, email, src, size = "md", className }: AvatarProps) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name || email || "avatar"} className={cn("rounded-full object-cover", SIZES[size], className)} />;
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-accent font-semibold text-white",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name, email)}
    </div>
  );
}
