import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Shield, KeyRound, Smartphone, Monitor, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface Session {
  session_id: string;
  device_name: string | null;
  device_type: string | null;
  os_name: string | null;
  browser_name: string | null;
  ip_address: string | null;
  last_activity: string;
}

interface ActivityRow {
  timestamp: string;
  ip_address: string | null;
  device: string;
  status: "success" | "failed";
  failure_reason: string | null;
}

interface TwoFAInit {
  secret: string;
  qr_code: string;
  recovery_codes: string[];
}

export default function AccountSettingsPage() {
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAInit, setTwoFAInit] = useState<TwoFAInit | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [twoFAMsg, setTwoFAMsg] = useState("");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      fetch("/api/settings/account/2fa", { headers: auth }).then((r) => r.ok ? r.json() : null),
      fetch("/api/settings/account/sessions", { headers: auth }).then((r) => r.ok ? r.json() : []),
      fetch("/api/settings/account/activity", { headers: auth }).then((r) => r.ok ? r.json() : []),
    ]).then(([twofa, sess, act]) => {
      if (twofa) setTwoFAEnabled(twofa.is_enabled);
      setSessions(sess);
      setActivity(act);
    }).finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changePassword() {
    if (pw.next !== pw.confirm) { setPwMsg("Passwords don't match"); return; }
    if (pw.next.length < 8) { setPwMsg("Password must be at least 8 characters"); return; }
    setPwMsg("");
    const res = await fetch("/api/settings/account/change-password", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: pw.current, new_password: pw.next }),
    });
    if (res.ok) {
      setPwMsg("Password changed ✓");
      setPw({ current: "", next: "", confirm: "" });
    } else {
      const d = await res.json().catch(() => ({}));
      setPwMsg(d.detail || "Failed to change password");
    }
  }

  async function init2FA() {
    const res = await fetch("/api/settings/account/2fa/init", { method: "POST", headers: auth });
    if (res.ok) setTwoFAInit(await res.json());
    else setTwoFAMsg("Could not initialize 2FA");
  }

  async function confirm2FA() {
    const res = await fetch("/api/settings/account/2fa/confirm", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ totp_code: totpCode }),
    });
    if (res.ok) {
      setTwoFAEnabled(true);
      setTwoFAInit(null);
      setTwoFAMsg("2FA enabled ✓");
    } else {
      setTwoFAMsg("Invalid code — try again");
    }
  }

  async function logoutOthers() {
    const res = await fetch("/api/settings/account/sessions/logout-others", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) setSessions((s) => (s ? s.slice(0, 1) : s));
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  return (
    <SettingsLayout>
      <Head><title>Account & Security — Settings</title></Head>
      {loading ? (
        <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : (
        <div className="space-y-5">

          {/* Change password */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Change Password</h2>
            </div>
            <div className="space-y-2">
              {[["Current password", "current"], ["New password", "next"], ["Confirm new password", "confirm"]].map(([label, k]) => (
                <div key={k}>
                  <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
                  <input
                    type="password"
                    value={pw[k as keyof typeof pw]}
                    onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
              {pwMsg && (
                <p className={`text-xs ${pwMsg.includes("✓") ? "text-emerald-400" : "text-red-400"}`}>{pwMsg}</p>
              )}
              <Button size="sm" onClick={changePassword} disabled={!pw.current || !pw.next}>
                Update password
              </Button>
            </div>
          </Card>

          {/* 2FA */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Two-Factor Authentication</h2>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${twoFAEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                {twoFAEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            {twoFAEnabled ? (
              <p className="text-sm text-white/40">2FA is active. Use your authenticator app to sign in.</p>
            ) : twoFAInit ? (
              <div className="space-y-3">
                <p className="text-xs text-white/50">Scan the QR code with Google Authenticator or similar, then enter the 6-digit code.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={twoFAInit.qr_code} alt="QR code" className="h-36 w-36 rounded-lg" />
                <p className="text-xs text-white/30">Manual key: <code className="text-indigo-400">{twoFAInit.secret}</code></p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">6-digit code from app</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="w-40 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm tracking-widest text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                {twoFAMsg && <p className="text-xs text-red-400">{twoFAMsg}</p>}
                <Button size="sm" disabled={totpCode.length !== 6} onClick={confirm2FA}>Verify & enable</Button>
              </div>
            ) : (
              <div>
                {twoFAMsg && <p className="mb-2 text-xs text-emerald-400">{twoFAMsg}</p>}
                <Button size="sm" variant="secondary" onClick={init2FA}>Enable 2FA</Button>
              </div>
            )}
          </Card>

          {/* Active sessions */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Active Sessions</h2>
              {sessions && sessions.length > 1 && (
                <button onClick={logoutOthers} className="ml-auto text-xs text-red-400 hover:text-red-300">
                  Logout all others
                </button>
              )}
            </div>
            {!sessions?.length ? (
              <p className="text-sm text-white/40">No active sessions.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={s.session_id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                    <Monitor className="h-4 w-4 shrink-0 text-white/30" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white">
                        {s.browser_name || "Unknown browser"} on {s.os_name || "Unknown OS"}
                        {i === 0 && <span className="ml-2 text-[10px] text-indigo-400">(current)</span>}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/30">
                        {s.ip_address} · Last active {fmtTime(s.last_activity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Login activity */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Recent Login Activity</h2>
            </div>
            {!activity?.length ? (
              <p className="text-sm text-white/40">No login history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {activity.slice(0, 10).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {a.status === "success" ? (
                      <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    )}
                    <span className="text-white/50">{fmtTime(a.timestamp)}</span>
                    <span className="truncate text-white/40">{a.device}</span>
                    {a.ip_address && <span className="text-white/30">{a.ip_address}</span>}
                    {a.failure_reason && <span className="text-red-400/70">{a.failure_reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      )}
    </SettingsLayout>
  );
}
