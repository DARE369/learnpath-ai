import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Download, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface ExportRow {
  export_id: string;
  status: string;
  requested_at: string;
  download_url: string | null;
  expires_at: string | null;
}

export default function PrivacySettingsPage() {
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [exports, setExports] = useState<ExportRow[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const [delConfirm, setDelConfirm] = useState("");
  const [delMsg, setDelMsg] = useState("");
  const [delPending, setDelPending] = useState(false);
  const [delScheduled, setDelScheduled] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/settings/privacy/export", { headers: auth })
      .then((r) => (r.ok ? r.json() : []))
      .then(setExports);
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function requestExport() {
    setExporting(true);
    setExportMsg("");
    try {
      const res = await fetch("/api/settings/privacy/export", { method: "POST", headers: auth });
      const d = await res.json();
      setExportMsg(d.message || "Export requested.");
      const res2 = await fetch("/api/settings/privacy/export", { headers: auth });
      if (res2.ok) setExports(await res2.json());
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    setDelMsg("");
    const res = await fetch("/api/settings/privacy/delete-account", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: delConfirm }),
    });
    const d = await res.json();
    if (res.ok) {
      setDelScheduled(d.scheduled_for);
      setDelMsg(d.message);
      setDelConfirm("");
    } else {
      setDelMsg(d.detail || "Something went wrong.");
    }
  }

  async function cancelDeletion() {
    const res = await fetch("/api/settings/privacy/cancel-deletion", { method: "POST", headers: auth });
    if (res.ok) {
      setDelScheduled(null);
      setDelMsg("Account deletion canceled.");
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <SettingsLayout>
      <Head><title>Privacy & Data — Settings</title></Head>

      <div className="space-y-5">

        {/* Data export */}
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Data Export (GDPR)</h2>
          </div>
          <p className="mb-3 text-sm text-white/50">
            Download a copy of all your data — profile, messages, classes, and assignments.
            The export link expires in 7 days.
          </p>
          {exportMsg && <p className="mb-3 text-xs text-emerald-400">{exportMsg}</p>}
          <Button size="sm" onClick={requestExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? "Requesting…" : "Export my data"}
          </Button>

          {exports && exports.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-white/30">Previous exports</p>
              {exports.map((e) => (
                <div key={e.export_id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-medium ${e.status === "completed" ? "text-emerald-400" : "text-amber-400"}`}>
                      {e.status}
                    </span>
                    <span className="ml-2 text-white/30">{fmtDate(e.requested_at)}</span>
                    {e.expires_at && <span className="ml-1 text-white/20">· expires {fmtDate(e.expires_at)}</span>}
                  </div>
                  {e.download_url && (
                    <a href={e.download_url} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                      Download <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Legal links */}
        <Card padding="md">
          <h2 className="mb-3 text-sm font-semibold text-white">Legal</h2>
          <div className="space-y-1.5">
            {[
              ["Privacy Policy", "#"],
              ["Terms of Service", "#"],
              ["GDPR Compliance", "#"],
            ].map(([label]) => (
              <button
                key={label}
                className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                onClick={() => window.alert(`${label} — link will be configured in deployment settings.`)}
              >
                {label} <ExternalLink className="h-3 w-3" />
              </button>
            ))}
          </div>
        </Card>

        {/* Delete account */}
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400">Delete Account</h2>
          </div>

          {delScheduled ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-300">Account deletion scheduled</p>
              <p className="mt-1 text-xs text-red-400/70">
                Your account will be permanently deleted on {fmtDate(delScheduled)}. You can cancel until then.
              </p>
              {delMsg && <p className="mt-1 text-xs text-white/40">{delMsg}</p>}
              <Button size="sm" variant="secondary" className="mt-3" onClick={cancelDeletion}>
                Cancel deletion
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-xs text-red-300">
                  Permanently deletes your account and all associated data. There is a 30-day grace period — you can cancel during that time.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">
                  Type <strong className="text-white">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={delConfirm}
                  onChange={(e) => setDelConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-red-500 focus:outline-none"
                />
                {delMsg && <p className="text-xs text-red-400">{delMsg}</p>}
                <Button
                  size="sm"
                  disabled={delConfirm !== "DELETE" || delPending}
                  onClick={() => { setDelPending(true); requestDeletion().finally(() => setDelPending(false)); }}
                  className="bg-red-600 hover:bg-red-500"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete my account
                </Button>
              </div>
            </>
          )}
        </Card>

      </div>
    </SettingsLayout>
  );
}
