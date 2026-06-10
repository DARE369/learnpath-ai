import React from "react";
import { useRouter } from "next/router";
import {
  User,
  Shield,
  BookOpen,
  Plug,
  Sliders,
  Bell,
  CreditCard,
  Lock,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const NAV = [
  { href: "/teacher/settings/profile",       label: "Profile",          icon: User },
  { href: "/teacher/settings/account",       label: "Account & Security", icon: Shield },
  { href: "/teacher/settings/classes",       label: "Classes",          icon: BookOpen },
  { href: "/teacher/settings/integrations",  label: "Integrations",     icon: Plug },
  { href: "/teacher/settings/preferences",   label: "Preferences",      icon: Sliders },
  { href: "/teacher/settings/notifications", label: "Notifications",    icon: Bell },
  { href: "/teacher/settings/billing",       label: "Billing",          icon: CreditCard },
  { href: "/teacher/settings/privacy",       label: "Privacy & Data",   icon: Lock },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout } = useAuth();
  const current = router.pathname;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>
      <div className="flex flex-col gap-6 md:flex-row">

        {/* Sidebar nav */}
        <nav className="w-full shrink-0 md:w-52">
          <ul className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = current === href;
              return (
                <li key={href}>
                  <button
                    onClick={() => router.push(href)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-indigo-500/20 font-semibold text-indigo-400"
                        : "text-white/50 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                </li>
              );
            })}
            <li className="pt-2">
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </li>
          </ul>
        </nav>

        {/* Page content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
