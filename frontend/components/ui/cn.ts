// Tiny className combiner — avoids a clsx dependency. Falsy parts are dropped.
export type ClassValue = string | number | null | false | undefined;

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
