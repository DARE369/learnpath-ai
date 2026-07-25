import type { IconName } from "./icons";

export interface NavItemV2 {
  icon: IconName;
  label: string;
  href: string;
}

/**
 * Flat learner nav matching `Learner Dashboard.dc.html` et al. The new design
 * consolidates several existing routes (Explore+Paths+Course browsing →
 * "Paths"; Activity+Achievements → "History"; Loyalty+Referral → "Rewards")
 * but those destination pages haven't been migrated yet. Until each one is,
 * these links point at today's closest existing equivalent route rather
 * than a not-yet-built merged page — update the href here (not the label)
 * as each destination gets its own ui-v2 migration.
 */
export const LEARNER_NAV_V2: NavItemV2[] = [
  { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { icon: "paths", label: "Paths", href: "/paths" },
  { icon: "concepts", label: "Concepts", href: "/concepts" },
  { icon: "examprep", label: "Exam prep", href: "/exams" },
  { icon: "review", label: "Review", href: "/review" },
  { icon: "history", label: "History", href: "/history" },
  { icon: "rewards", label: "Rewards", href: "/rewards" },
  { icon: "buddies", label: "Buddies", href: "/buddies" },
  { icon: "settings", label: "Settings", href: "/settings" },
];

/**
 * Teacher nav — no matching .dc.html design file specifies this list, so it
 * mirrors the legacy teacher nav's items (components/layout/nav.ts) using
 * the closest available icons, restyled with the same ui-v2 chrome as the
 * learner sidebar. Unmigrated teacher routes (assignments, analytics,
 * at-risk, settings) still work since Next routing doesn't require every
 * link target to be ui-v2 — they just render inside the legacy AppShell
 * per _app.tsx's per-route shell selection.
 */
export const TEACHER_NAV_V2: NavItemV2[] = [
  { icon: "dashboard", label: "Dashboard", href: "/teacher/dashboard" },
  { icon: "paths", label: "Assignments", href: "/teacher/assignments" },
  { icon: "examprep", label: "Analytics", href: "/teacher/analytics" },
  { icon: "review", label: "At-risk students", href: "/teacher/at-risk" },
  { icon: "settings", label: "Settings", href: "/teacher/settings" },
];

/**
 * School admin nav — matches `School Dashboard.dc.html`'s sidebar
 * (Dashboard / Teachers / Students / Classes / Billing / Settings).
 * Settings has no dedicated school-admin design file yet, so it links at
 * the dashboard for now — update once a School Settings screen exists.
 */
export const SCHOOL_NAV_V2: NavItemV2[] = [
  { icon: "dashboard", label: "Dashboard", href: "/school/dashboard" },
  { icon: "teachers", label: "Teachers", href: "/school/roster?tab=teachers" },
  { icon: "students", label: "Students", href: "/school/roster?tab=students" },
  { icon: "classes", label: "Classes", href: "/school/roster?tab=classes" },
  { icon: "billing", label: "Billing", href: "/school/billing" },
];

export function navForRoleV2(role?: string): NavItemV2[] {
  if (role === "teacher") return TEACHER_NAV_V2;
  if (role === "school_admin") return SCHOOL_NAV_V2;
  return LEARNER_NAV_V2;
}
