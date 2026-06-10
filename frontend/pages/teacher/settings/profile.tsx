import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Save, User } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

const GRADE_OPTIONS = ["K", "1-3", "4-6", "7-8", "9-12", "Higher Ed"];

interface ProfileData {
  full_name: string;
  email: string;
  email_verified: boolean;
  bio: string;
  phone: string;
  school_name: string;
  grade_levels: string[];
  social_links: { linkedin?: string; twitter?: string; portfolio?: string };
  avatar_url: string;
}

export default function ProfileSettingsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/settings/profile", { headers: auth })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setData({
          full_name: d.full_name || "",
          email: d.email || "",
          email_verified: d.email_verified,
          bio: d.bio || "",
          phone: d.phone || "",
          school_name: d.school_name || "",
          grade_levels: d.grade_levels || [],
          social_links: d.social_links || {},
          avatar_url: d.avatar_url || "",
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(grade: string) {
    if (!data) return;
    const has = data.grade_levels.includes(grade);
    setData({ ...data, grade_levels: has ? data.grade_levels.filter((g) => g !== grade) : [...data.grade_levels, grade] });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof ProfileData, type = "text") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
        <input
          type={type}
          value={(data?.[key] as string) || ""}
          onChange={(e) => data && setData({ ...data, [key]: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <SettingsLayout>
      <Head><title>Profile — Settings</title></Head>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : !data ? (
        <p className="text-sm text-white/40">Failed to load profile.</p>
      ) : (
        <div className="space-y-5">

          {/* Avatar */}
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-white">Avatar</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 overflow-hidden">
                {data.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7" />
                )}
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-white/50">Avatar URL</label>
                <input
                  type="url"
                  value={data.avatar_url}
                  onChange={(e) => setData({ ...data, avatar_url: e.target.value })}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-white/30">Paste a direct image URL (JPEG/PNG/WebP)</p>
              </div>
            </div>
          </Card>

          {/* Personal info */}
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-white">Personal Info</h2>
            <div className="space-y-3">
              {field("Full name", "full_name")}
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={data.email}
                    readOnly
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50 focus:outline-none cursor-not-allowed"
                  />
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${data.email_verified ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {data.email_verified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Bio</label>
                <textarea
                  rows={3}
                  value={data.bio}
                  onChange={(e) => setData({ ...data, bio: e.target.value })}
                  placeholder="Tell students a bit about yourself…"
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Professional */}
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-white">Professional</h2>
            <div className="space-y-3">
              {field("School name", "school_name")}
              {field("Phone", "phone", "tel")}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Grade levels taught</label>
                <div className="flex flex-wrap gap-2">
                  {GRADE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      onClick={() => toggle(g)}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        data.grade_levels.includes(g)
                          ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-400"
                          : "border-white/10 bg-white/5 text-white/40 hover:text-white"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Social links */}
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-white">Social Links</h2>
            <div className="space-y-3">
              {(["linkedin", "twitter", "portfolio"] as const).map((k) => (
                <div key={k}>
                  <label className="mb-1 block text-xs font-medium capitalize text-white/50">{k}</label>
                  <input
                    type="text"
                    value={data.social_links[k] || ""}
                    onChange={(e) => setData({ ...data, social_links: { ...data.social_links, [k]: e.target.value } })}
                    placeholder={k === "twitter" ? "@username" : "https://…"}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-between">
            {saved && <p className="text-xs text-emerald-400">Changes saved ✓</p>}
            <Button onClick={save} disabled={saving} className="ml-auto">
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
