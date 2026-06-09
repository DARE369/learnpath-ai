import type React from "react";
import {
  LayoutDashboard,
  Compass,
  Route,
  GraduationCap,
  RotateCcw,
  FileText,
  Upload,
  Network,
  Users,
  Gift,
  Award,
  CreditCard,
  Settings,
  School,
  AlertTriangle,
  ClipboardList,
  Shield,
  TrendingUp,
  Layers,
  ShieldCheck,
  Ban,
} from "lucide-react";

// Icons are passed as components so the Sidebar can size them consistently.
export type NavIcon = React.ComponentType<{ className?: string }>;

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// The app's audiences. `student` is the default (maps from the legacy "user").
export type NavRole = "student" | "teacher" | "school_admin" | "admin";

const STUDENT: NavGroup[] = [
  {
    label: "Learn",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Explore", href: "/explore", icon: Compass },
      { label: "Paths", href: "/paths", icon: Route },
      { label: "Exams", href: "/exams", icon: GraduationCap },
      { label: "Review", href: "/review", icon: RotateCcw },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Notes", href: "/notes", icon: FileText },
      { label: "Uploads", href: "/upload", icon: Upload },
      { label: "Concepts", href: "/concepts", icon: Network },
    ],
  },
  {
    label: "Social",
    items: [
      { label: "Buddies", href: "/buddies", icon: Users },
      { label: "Referral", href: "/referral", icon: Gift },
      { label: "Loyalty", href: "/loyalty", icon: Award },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const TEACHER: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
      { label: "Assignments", href: "/teacher/assignments", icon: ClipboardList },
      { label: "At-risk students", href: "/teacher/at-risk", icon: AlertTriangle },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

const SCHOOL_ADMIN: NavGroup[] = [
  {
    label: "School",
    items: [{ label: "Dashboard", href: "/school/dashboard", icon: School }],
  },
  {
    label: "Account",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const ADMIN: NavGroup[] = [
  {
    label: "Platform admin",
    items: [
      { label: "Overview", href: "/admin", icon: Shield },
      { label: "Platform", href: "/admin/platform", icon: TrendingUp },
      { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
      { label: "Customer success", href: "/admin/customer-success", icon: Users },
      { label: "Expansion", href: "/admin/expansion", icon: Layers },
      { label: "Confidence", href: "/admin/confidence", icon: ShieldCheck },
      { label: "Blacklist", href: "/admin/blacklist", icon: Ban },
    ],
  },
];

export const BY_ROLE: Record<NavRole, NavGroup[]> = {
  student: STUDENT,
  teacher: TEACHER,
  school_admin: SCHOOL_ADMIN,
  admin: ADMIN,
};

// Resolve a User.role string (which may still be the legacy "user") to nav groups.
export function navForRole(role?: string): NavGroup[] {
  switch (role) {
    case "teacher":
      return TEACHER;
    case "school_admin":
      return SCHOOL_ADMIN;
    case "admin":
      return ADMIN;
    default:
      return STUDENT; // "student" and legacy "user"
  }
}

// Where each role lands after login.
export function homeForRole(role?: string): string {
  switch (role) {
    case "teacher":
      return "/teacher/dashboard";
    case "school_admin":
      return "/school/dashboard";
    case "admin":
      return "/admin";
    default:
      return "/dashboard";
  }
}
