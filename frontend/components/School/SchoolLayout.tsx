import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CreditCard,
  Settings,
  ShieldCheck,
  Plug,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const NAV = [
  { label: "Dashboard", href: "/school/dashboard", icon: LayoutDashboard },
  { label: "Teachers", href: "/school/teachers", icon: Users },
  { label: "Students", href: "/school/students", icon: GraduationCap },
  { label: "Classes", href: "/school/classes", icon: BookOpen },
  { label: "Billing", href: "/school/billing", icon: CreditCard },
  { label: "Settings", href: "/school/settings", icon: Settings },
  { label: "Compliance", href: "/school/compliance", icon: ShieldCheck },
  { label: "Integrations", href: "/school/integrations", icon: Plug },
];

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#0f0f0f]">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-white/5 bg-[#141414]">
        <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            LP
          </div>
          <span className="text-xs font-semibold text-white/70">School Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/school/dashboard"
                ? router.pathname === href
                : router.pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  active
                    ? "bg-indigo-600/15 text-indigo-400"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
