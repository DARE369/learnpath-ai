import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Bell, Mail, Save, ArrowLeft } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";

interface NotifPrefs {
  email_enabled: boolean;
  email_direct_messages: boolean;
  email_group_messages: boolean;
  email_announcements: boolean;
  email_replies: boolean;
  email_frequency: "immediate" | "daily_digest";
  in_app_enabled: boolean;
  in_app_direct_messages: boolean;
  in_app_group_messages: boolean;
  in_app_announcements: boolean;
  in_app_replies: boolean;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        checked ? "bg-indigo-500" : "bg-white/20"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function PrefRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${disabled ? "text-white/40" : "text-white"}`}>{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-white/30">{description}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/messaging/notification-preferences", { headers: auth })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPrefs(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/messaging/notification-preferences", {
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

  return (
    <>
      <Head><title>Notification Settings — LearnPath AI</title></Head>
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">

        <button
          onClick={() => router.push("/teacher/messages")}
          className="mb-4 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Messages
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Notification Settings</h1>
          <p className="mt-0.5 text-sm text-white/40">
            Control how and when LearnPath notifies you about messages and announcements.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !prefs ? (
          <p className="text-sm text-white/40">Failed to load preferences.</p>
        ) : (
          <div className="space-y-5">

            {/* Email */}
            <Card padding="md">
              <div className="mb-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Email Notifications</h2>
              </div>
              <div className="divide-y divide-white/5">
                <PrefRow
                  label="Email notifications"
                  description="Master switch for all email alerts"
                  checked={prefs.email_enabled}
                  onChange={(v) => set("email_enabled", v)}
                />
                <PrefRow
                  label="1-on-1 messages"
                  checked={prefs.email_direct_messages}
                  onChange={(v) => set("email_direct_messages", v)}
                  disabled={!prefs.email_enabled}
                />
                <PrefRow
                  label="Group messages"
                  checked={prefs.email_group_messages}
                  onChange={(v) => set("email_group_messages", v)}
                  disabled={!prefs.email_enabled}
                />
                <PrefRow
                  label="Class announcements"
                  checked={prefs.email_announcements}
                  onChange={(v) => set("email_announcements", v)}
                  disabled={!prefs.email_enabled}
                />
                <PrefRow
                  label="Replies to my messages"
                  checked={prefs.email_replies}
                  onChange={(v) => set("email_replies", v)}
                  disabled={!prefs.email_enabled}
                />
                <div className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className={`text-sm font-medium ${!prefs.email_enabled ? "text-white/40" : "text-white"}`}>
                      Frequency
                    </p>
                    <p className="mt-0.5 text-xs text-white/30">How often to receive email digests</p>
                  </div>
                  <select
                    value={prefs.email_frequency}
                    onChange={(e) => set("email_frequency", e.target.value as "immediate" | "daily_digest")}
                    disabled={!prefs.email_enabled}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="daily_digest">Daily digest</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* In-app */}
            <Card padding="md">
              <div className="mb-1 flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">In-App Notifications</h2>
              </div>
              <div className="divide-y divide-white/5">
                <PrefRow
                  label="In-app notifications"
                  description="Master switch for all in-app alerts"
                  checked={prefs.in_app_enabled}
                  onChange={(v) => set("in_app_enabled", v)}
                />
                <PrefRow
                  label="1-on-1 messages"
                  checked={prefs.in_app_direct_messages}
                  onChange={(v) => set("in_app_direct_messages", v)}
                  disabled={!prefs.in_app_enabled}
                />
                <PrefRow
                  label="Group messages"
                  checked={prefs.in_app_group_messages}
                  onChange={(v) => set("in_app_group_messages", v)}
                  disabled={!prefs.in_app_enabled}
                />
                <PrefRow
                  label="Class announcements"
                  checked={prefs.in_app_announcements}
                  onChange={(v) => set("in_app_announcements", v)}
                  disabled={!prefs.in_app_enabled}
                />
                <PrefRow
                  label="Replies to my messages"
                  checked={prefs.in_app_replies}
                  onChange={(v) => set("in_app_replies", v)}
                  disabled={!prefs.in_app_enabled}
                />
              </div>
            </Card>

            <div className="flex items-center justify-between">
              {saved && (
                <p className="text-xs text-emerald-400">Preferences saved ✓</p>
              )}
              <Button onClick={save} disabled={saving} className="ml-auto">
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Save preferences"}
              </Button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
