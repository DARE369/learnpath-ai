import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";

interface ProfileForm {
  fullName: string;
  email: string;
}

interface PreferencesForm {
  dailyGoalMinutes: number;
  reminderTime: string;
  notifyEmail: boolean;
  notifyStreak: boolean;
  notifyProduct: boolean;
}

type SaveState = { type: "idle" } | { type: "saving" } | { type: "saved" } | { type: "error"; message: string };

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-surface-hover"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-elevated border border-border rounded-2xl p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileForm>({ fullName: "", email: "" });
  const [profileSave, setProfileSave] = useState<SaveState>({ type: "idle" });

  const [prefs, setPrefs] = useState<PreferencesForm>({
    dailyGoalMinutes: 30,
    reminderTime: "18:00",
    notifyEmail: true,
    notifyStreak: true,
    notifyProduct: false,
  });
  const [prefsSave, setPrefsSave] = useState<SaveState>({ type: "idle" });

  useEffect(() => {
    if (user) {
      setProfile({ fullName: user.fullName || "", email: user.email });
    }
  }, [user]);

  function fakeSave(setState: (s: SaveState) => void) {
    setState({ type: "saving" });
    setTimeout(() => {
      setState({ type: "saved" });
      setTimeout(() => setState({ type: "idle" }), 2200);
    }, 600);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.fullName.trim()) {
      setProfileSave({ type: "error", message: "Full name is required" });
      return;
    }
    fakeSave(setProfileSave);
  }

  function handlePrefsSubmit(e: React.FormEvent) {
    e.preventDefault();
    fakeSave(setPrefsSave);
  }

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  return (
    <>
      <Head>
        <title>Settings — LearnPath AI</title>
      </Head>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Settings</h1>
          <p className="text-white/50">Manage your profile, preferences, and account.</p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <Section title="Profile" description="How you appear to LearnPath AI.">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="label">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                  className="input-field"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="input-field opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-white/30 mt-1.5">Email cannot be changed from this screen.</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                {profileSave.type === "saved" && (
                  <span className="text-xs text-success">Saved</span>
                )}
                {profileSave.type === "error" && (
                  <span className="text-xs text-error">{profileSave.message}</span>
                )}
                <button
                  type="submit"
                  disabled={profileSave.type === "saving"}
                  className="px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {profileSave.type === "saving" ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </Section>

          {/* Learning preferences */}
          <Section title="Learning preferences" description="Shape your daily learning rhythm.">
            <form onSubmit={handlePrefsSubmit} className="space-y-5">
              <div>
                <label htmlFor="goal" className="label">Daily goal</label>
                <select
                  id="goal"
                  value={prefs.dailyGoalMinutes}
                  onChange={(e) => setPrefs((p) => ({ ...p, dailyGoalMinutes: Number(e.target.value) }))}
                  className="input-field"
                >
                  <option value={15}>15 minutes / day</option>
                  <option value={30}>30 minutes / day</option>
                  <option value={45}>45 minutes / day</option>
                  <option value={60}>1 hour / day</option>
                  <option value={120}>2 hours / day</option>
                </select>
              </div>
              <div>
                <label htmlFor="reminder" className="label">Daily reminder time</label>
                <input
                  id="reminder"
                  type="time"
                  value={prefs.reminderTime}
                  onChange={(e) => setPrefs((p) => ({ ...p, reminderTime: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="border-t border-border pt-2">
                <Toggle
                  checked={prefs.notifyEmail}
                  onChange={(v) => setPrefs((p) => ({ ...p, notifyEmail: v }))}
                  label="Email reminders"
                  description="Get a nudge if you miss your daily goal."
                />
                <Toggle
                  checked={prefs.notifyStreak}
                  onChange={(v) => setPrefs((p) => ({ ...p, notifyStreak: v }))}
                  label="Streak alerts"
                  description="Heads-up before your streak would break."
                />
                <Toggle
                  checked={prefs.notifyProduct}
                  onChange={(v) => setPrefs((p) => ({ ...p, notifyProduct: v }))}
                  label="Product updates"
                  description="Occasional notes about new features."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {prefsSave.type === "saved" && <span className="text-xs text-success">Saved</span>}
                <button
                  type="submit"
                  disabled={prefsSave.type === "saving"}
                  className="px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {prefsSave.type === "saving" ? "Saving…" : "Save preferences"}
                </button>
              </div>
            </form>
          </Section>

          {/* Account */}
          <Section title="Account" description="Sign out or manage your account.">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Sign out</p>
                <p className="text-xs text-white/40 mt-0.5">End your session on this device.</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-xl bg-error-muted text-error text-sm font-semibold hover:bg-error/20 transition-colors"
              >
                Sign out
              </button>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
