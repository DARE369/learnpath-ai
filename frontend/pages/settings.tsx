import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { Card, TextField, Toggle, Modal, ModalTitle } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";

const PREFS_STORAGE_KEY = "learnpath:learning-prefs:v1";

interface ProfileForm { fullName: string; email: string; }
interface PreferencesForm { dailyGoalMinutes: number; reminderTime: string; notifyEmail: boolean; notifyStreak: boolean; notifyProduct: boolean; }
type SaveState = { type: "idle" } | { type: "saving" } | { type: "saved" } | { type: "error"; message: string };

const SECTIONS = [
  { key: "account", label: "Account" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy & data" },
  { key: "danger", label: "Delete account" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export default function SettingsPage() {
  const router = useRouter();
  const { user, accessToken, logout } = useAuth();
  const [section, setSection] = useState<SectionKey>("account");

  const [profile, setProfile] = useState<ProfileForm>({ fullName: "", email: "" });
  const [profileSave, setProfileSave] = useState<SaveState>({ type: "idle" });

  const [prefs, setPrefs] = useState<PreferencesForm>({ dailyGoalMinutes: 30, reminderTime: "18:00", notifyEmail: true, notifyStreak: true, notifyProduct: false });
  const [prefsSave, setPrefsSave] = useState<SaveState>({ type: "idle" });

  useEffect(() => { if (user) setProfile({ fullName: user.fullName || "", email: user.email }); }, [user]);

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
    if (!profile.fullName.trim()) { setProfileSave({ type: "error", message: "Full name is required" }); return; }
    if (!accessToken) { setProfileSave({ type: "error", message: "You're not signed in." }); return; }
    setProfileSave({ type: "saving" });
    try {
      await axios.patch("/api/auth/me", { full_name: profile.fullName.trim() }, { headers: { Authorization: `Bearer ${accessToken}` } });
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
      if (typeof window !== "undefined") localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      flashSaved(setPrefsSave);
    } catch {
      setPrefsSave({ type: "error", message: "Couldn't save preferences locally." });
    }
  }

  function handleLogout() { logout(); router.push("/auth/login"); }

  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    if (!accessToken) return;
    setExporting(true);
    try {
      const res = await axios.get("/api/auth/export", { headers: { Authorization: `Bearer ${accessToken}` } });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `learnpath-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* surfaced via button state only */ }
    finally { setExporting(false); }
  }

  async function handleDeleteAccount() {
    if (!accessToken) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.post("/api/auth/account/delete", { confirm: true, password: deletePassword || undefined }, { headers: { Authorization: `Bearer ${accessToken}` } });
      logout();
      router.push("/");
    } catch (err: unknown) {
      let message = "Couldn't delete your account.";
      if (axios.isAxiosError(err)) message = (err.response?.data as { detail?: string } | undefined)?.detail || message;
      setDeleteError(message);
      setDeleting(false);
    }
  }

  const savedText = (s: SaveState) => (s.type === "saved" ? <span style={{ fontSize: 12, color: color.success.fg }}>Saved</span> : s.type === "error" ? <span style={{ fontSize: 12, color: color.danger.fg }}>{s.message}</span> : null);

  return (
    <>
      <Head><title>Settings — LearnPath AI</title></Head>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", fontFamily: font.body }}>
        <div style={{ width: 190, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 22, margin: "0 0 16px" }}>Settings</h1>
          {SECTIONS.map((s) => (
            <div key={s.key} onClick={() => setSection(s.key)} style={{ padding: "9px 12px", borderRadius: 7, fontSize: 13.5, fontWeight: 500, cursor: "pointer", color: section === s.key ? color.ink : s.key === "danger" ? color.danger.fg : color.inkSoft, background: section === s.key ? color.surfaceElevated : "transparent" }}>
              {s.label}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, maxWidth: 560 }}>
          {section === "account" && (
            <>
              <Card padding="lg" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Profile</div>
                <form onSubmit={handleProfileSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <TextField label="Full name" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <TextField label="Email address" value={profile.email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
                    <p style={{ fontSize: 11.5, color: color.textFaint, marginTop: 6 }}>Email cannot be changed from this screen.</p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
                    {savedText(profileSave)}
                    <button type="submit" disabled={profileSave.type === "saving"} style={{ padding: "10px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{profileSave.type === "saving" ? "Saving…" : "Save changes"}</button>
                  </div>
                </form>
              </Card>

              <Card padding="lg">
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sign out</div>
                <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 16 }}>End your session on this device.</div>
                <button onClick={handleLogout} style={{ padding: "9px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 6, border: "1px solid #E7B7AE", background: color.danger.bg, color: color.danger.fg, cursor: "pointer" }}>Sign out</button>
              </Card>
            </>
          )}

          {section === "notifications" && (
            <Card padding="lg">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Learning preferences</div>
              <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 18 }}>Shape your daily learning rhythm.</div>
              <form onSubmit={handlePrefsSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Daily goal</label>
                  <select value={prefs.dailyGoalMinutes} onChange={(e) => setPrefs((p) => ({ ...p, dailyGoalMinutes: Number(e.target.value) }))} style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #CFCBC0", borderRadius: 6 }}>
                    <option value={15}>15 minutes / day</option>
                    <option value={30}>30 minutes / day</option>
                    <option value={45}>45 minutes / day</option>
                    <option value={60}>1 hour / day</option>
                    <option value={120}>2 hours / day</option>
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <TextField label="Daily reminder time" type="time" value={prefs.reminderTime} onChange={(e) => setPrefs((p) => ({ ...p, reminderTime: e.target.value }))} />
                </div>
                <div style={{ borderTop: `1px solid ${color.borderMuted}`, paddingTop: 4 }}>
                  <Toggle checked={prefs.notifyEmail} onChange={(v) => setPrefs((p) => ({ ...p, notifyEmail: v }))} label="Email reminders" description="Get a nudge if you miss your daily goal." />
                  <Toggle checked={prefs.notifyStreak} onChange={(v) => setPrefs((p) => ({ ...p, notifyStreak: v }))} label="Streak alerts" description="Heads-up before your streak would break." />
                  <Toggle checked={prefs.notifyProduct} onChange={(v) => setPrefs((p) => ({ ...p, notifyProduct: v }))} label="Product updates" description="Occasional notes about new features." />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 14 }}>
                  {prefsSave.type === "saved" && <span style={{ fontSize: 12, color: color.success.fg }}>Saved</span>}
                  <button type="submit" disabled={prefsSave.type === "saving"} style={{ padding: "10px 18px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{prefsSave.type === "saving" ? "Saving…" : "Save preferences"}</button>
                </div>
              </form>
            </Card>
          )}

          {section === "privacy" && (
            <Card padding="lg">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Privacy & data</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: `1px solid ${color.borderMuted}`, paddingBottom: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Download my data</div>
                  <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>Get a JSON copy of everything we hold for you.</div>
                </div>
                <button onClick={handleExport} disabled={exporting} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, cursor: "pointer" }}>{exporting ? "Preparing…" : "Download data"}</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>Manage billing</div>
                  <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>View plan, usage, and payment history.</div>
                </div>
                <Link href="/billing" style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: `1px solid ${color.border}`, background: "#fff", color: color.ink, textDecoration: "none" }}>Go to Billing</Link>
              </div>
            </Card>
          )}

          {section === "danger" && (
            <Card padding="lg" style={{ border: "1px solid #E7B7AE" }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: color.danger.fg }}>Delete account</div>
              <div style={{ fontSize: 12.5, color: color.textFaint, marginBottom: 18 }}>Permanently deletes your account and all associated data. This can&rsquo;t be undone.</div>
              <button onClick={() => { setDeleteOpen(true); setDeleteError(null); setDeletePassword(""); }} style={{ padding: "9px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 6, border: `1px solid ${color.danger.fg}`, background: "#fff", color: color.danger.fg, cursor: "pointer" }}>Delete account</button>
            </Card>
          )}
        </div>
      </div>

      {deleteOpen && (
        <Modal onClose={() => !deleting && setDeleteOpen(false)}>
          <ModalTitle danger>Delete your account?</ModalTitle>
          <p style={{ fontSize: 13, color: color.textFaint, marginBottom: 14 }}>This permanently removes your personal data and signs you out. This action can&rsquo;t be undone.</p>
          {user?.email && (
            <div style={{ marginBottom: 14 }}>
              <TextField label="Confirm your password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <p style={{ fontSize: 11, color: color.textFainter, marginTop: 5 }}>Leave blank if you signed up with Google.</p>
            </div>
          )}
          {deleteError && <p style={{ fontSize: 13, color: color.danger.fg, marginBottom: 10 }}>{deleteError}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setDeleteOpen(false)} disabled={deleting} style={{ padding: "9px 16px", fontSize: 13, color: color.inkSoft, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDeleteAccount} disabled={deleting} style={{ padding: "10px 18px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", background: color.danger.fg, color: "#fff", cursor: "pointer" }}>{deleting ? "Deleting…" : "Delete forever"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
