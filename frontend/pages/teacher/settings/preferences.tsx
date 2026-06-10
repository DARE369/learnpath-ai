import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Save } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface Prefs {
  theme: string;
  language: string;
  timezone: string;
  default_class_view: string;
  auto_refresh_interval: number;
  remember_sidebar_state: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  alert_at_risk: boolean;
  alert_low_submission: boolean;
  alert_system: boolean;
}

const TIMEZONES = [
  "UTC", "Africa/Lagos", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Tokyo", "Australia/Sydney",
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-indigo-500" : "bg-white/20"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function PreferencesSettingsPage() {
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/settings/preferences", { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrefs(d))
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setPrefs((p) => (p ? { ...p, [k]: v } : p));
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const sel = (label: string, key: keyof Prefs, options: Array<[string, string]>) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-sm text-white/70">{label}</label>
      <select
        value={prefs?.[key] as string}
        onChange={(e) => set(key, e.target.value as Prefs[typeof key])}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <SettingsLayout>
      <Head><title>Preferences — Settings</title></Head>
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : !prefs ? (
        <p className="text-sm text-white/40">Failed to load preferences.</p>
      ) : (
        <div className="space-y-5">

          {/* Display */}
          <Card padding="md">
            <h2 className="mb-2 text-sm font-semibold text-white">Display</h2>
            <div className="divide-y divide-white/5">
              {sel("Theme", "theme", [["system", "System default"], ["dark", "Dark"], ["light", "Light"]])}
              {sel("Language", "language", [["en", "English"]])}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm text-white/70">Timezone</label>
                <select
                  value={prefs.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                  className="max-w-[180px] rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {/* Dashboard defaults */}
          <Card padding="md">
            <h2 className="mb-2 text-sm font-semibold text-white">Dashboard Defaults</h2>
            <div className="divide-y divide-white/5">
              {sel("Default class view", "default_class_view", [["list", "List"], ["grid", "Grid"], ["calendar", "Calendar"]])}
              {sel("Auto-refresh", "auto_refresh_interval", [
                ["0", "Never"], ["60", "Every 1 min"], ["300", "Every 5 min"], ["900", "Every 15 min"],
              ])}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm text-white/70">Remember sidebar state</label>
                <Toggle checked={prefs.remember_sidebar_state} onChange={(v) => set("remember_sidebar_state", v)} />
              </div>
            </div>
          </Card>

          {/* Quiet hours */}
          <Card padding="md">
            <h2 className="mb-2 text-sm font-semibold text-white">Quiet Hours</h2>
            <div className="divide-y divide-white/5">
              <div className="flex items-center justify-between py-2">
                <label className="text-sm text-white/70">Enable quiet hours</label>
                <Toggle checked={prefs.quiet_hours_enabled} onChange={(v) => set("quiet_hours_enabled", v)} />
              </div>
              {prefs.quiet_hours_enabled && (
                <div className="flex items-center gap-3 py-2">
                  <label className="text-sm text-white/70">From</label>
                  <input type="time" value={prefs.quiet_hours_start}
                    onChange={(e) => set("quiet_hours_start", e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-indigo-500 focus:outline-none" />
                  <label className="text-sm text-white/70">to</label>
                  <input type="time" value={prefs.quiet_hours_end}
                    onChange={(e) => set("quiet_hours_end", e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white [color-scheme:dark] focus:border-indigo-500 focus:outline-none" />
                </div>
              )}
            </div>
          </Card>

          {/* Dashboard alerts */}
          <Card padding="md">
            <h2 className="mb-2 text-sm font-semibold text-white">Dashboard Alerts</h2>
            <div className="divide-y divide-white/5">
              {[
                ["At-risk student alerts (3+ drop below 60%)", "alert_at_risk"],
                ["Low assignment submission rate (<80%)", "alert_low_submission"],
                ["System notifications (maintenance, updates)", "alert_system"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <label className="text-sm text-white/70">{label}</label>
                  <Toggle checked={!!prefs[key as keyof Prefs]} onChange={(v) => set(key as keyof Prefs, v as never)} />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            {saved && <p className="text-xs text-emerald-400">Preferences saved ✓</p>}
            <Button onClick={save} disabled={saving} className="ml-auto">
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
