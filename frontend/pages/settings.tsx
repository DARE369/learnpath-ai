import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const PREFS_STORAGE_KEY = "learnpath:learning-prefs:v1";

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
  const { user, accessToken, logout } = useAuth();

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

  // Load preferences from localStorage on mount. Preferences live client-side
  // until a backend table exists for them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch { /* malformed JSON — ignore */ }
  }, []);

  function flashSaved(setState: (s: SaveState) => void) {
    setState({ type: "saved" });
    setTimeout(() => setState({ type: "idle" }), 2200);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.fullName.trim()) {
      setProfileSave({ type: "error", message: "Full name is required" });
      return;
    }
    if (!accessToken) {
      setProfileSave({ type: "error", message: "You're not signed in." });
      return;
    }
    setProfileSave({ type: "saving" });
    try {
      await axios.patch(
        "/api/auth/me",
        { full_name: profile.fullName.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      flashSaved(setProfileSave);
    } catch (err: unknown) {
      let message = "Couldn't save your profile.";
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
        if (detail) message = detail;
        else if (err.response?.status === 401) message = "Session expired. Please sign in again.";
      }
      setProfileSave({ type: "error", message });
    }
  }

  function handlePrefsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPrefsSave({ type: "saving" });
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      }
      flashSaved(setPrefsSave);
    } catch {
      setPrefsSave({ type: "error", message: "Couldn't save preferences locally." });
    }
  }

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  // ── Privacy & data (Stage 8) ────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    if (!accessToken) return;
    setExporting(true);
    try {
      const res = await axios.get("/api/auth/export", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `learnpath-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* surfaced via button state only */
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!accessToken) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.post(
        "/api/auth/account/delete",
        { confirm: true, password: deletePassword || undefined },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      logout();
      router.push("/");
    } catch (err: unknown) {
      let message = "Couldn't delete your account.";
      if (axios.isAxiosError(err)) {
        message = (err.response?.data as { detail?: string } | undefined)?.detail || message;
      }
      setDeleteError(message);
      setDeleting(false);
    }
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

          {/* Privacy & data */}
          <Section title="Privacy & data" description="Export or permanently delete your data.">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-sm font-medium text-white">Download my data</p>
                <p className="text-xs text-white/40 mt-0.5">Get a JSON copy of everything we hold for you.</p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-5 py-2.5 rounded-xl bg-surface border border-border text-white/80 text-sm font-medium hover:text-white hover:border-white/25 transition-colors disabled:opacity-50"
              >
                {exporting ? "Preparing…" : "Download data"}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5">
              <div>
                <p className="text-sm font-medium text-white">Delete my account</p>
                <p className="text-xs text-white/40 mt-0.5">Permanently removes your personal data. This can&apos;t be undone.</p>
              </div>
              <button
                type="button"
                onClick={() => { setDeleteOpen(true); setDeleteError(null); setDeletePassword(""); }}
                className="px-5 py-2.5 rounded-xl bg-error-muted text-error text-sm font-semibold hover:bg-error/20 transition-colors"
              >
                Delete account
              </button>
            </div>
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

      {/* Delete-account confirm modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !deleting && setDeleteOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6">
            <h3 className="text-lg font-semibold text-white">Delete your account?</h3>
            <p className="mt-1 text-sm text-white/50">
              This permanently removes your personal data and signs you out. This action can&apos;t be undone.
            </p>
            {user?.email && (
              <div className="mt-4">
                <label htmlFor="delpw" className="label">Confirm your password</label>
                <input
                  id="delpw"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <p className="mt-1 text-xs text-white/30">Leave blank if you signed up with Google.</p>
              </div>
            )}
            {deleteError && <p className="mt-3 text-sm text-error">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-white/60 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-error text-onaccent text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
