import React, { useEffect, useState } from "react";
import Head from "next/head";
import { CheckCircle, Plug, ExternalLink } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface IntegrationItem {
  provider: string;
  connected: boolean;
  provider_email: string | null;
  provider_name: string | null;
  connected_at: string | null;
}

const PROVIDER_META: Record<string, { label: string; description: string; comingSoon?: boolean }> = {
  google_classroom: {
    label: "Google Classroom",
    description: "Import class rosters and sync assignments with Google Classroom.",
  },
  teams: {
    label: "Microsoft Teams",
    description: "Connect your Teams workspace for meetings and class communication.",
    comingSoon: true,
  },
  zoom: {
    label: "Zoom",
    description: "Schedule and launch Zoom meetings directly from LearnPath.",
    comingSoon: true,
  },
};

export default function IntegrationsSettingsPage() {
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [items, setItems] = useState<IntegrationItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/settings/integrations", { headers: auth })
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function disconnect(provider: string) {
    await fetch(`/api/settings/integrations/${provider}`, { method: "DELETE", headers: auth });
    setItems((prev) => prev?.map((i) => i.provider === provider ? { ...i, connected: false, provider_email: null } : i) ?? null);
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <SettingsLayout>
      <Head><title>Integrations — Settings</title></Head>
      <h2 className="mb-4 text-sm font-semibold text-white">Connected Apps</h2>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {(items || []).map((item) => {
            const meta = PROVIDER_META[item.provider] || { label: item.provider, description: "" };
            return (
              <Card key={item.provider} padding="md">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.connected ? "bg-indigo-500/20" : "bg-white/5"}`}>
                    {item.connected ? (
                      <CheckCircle className="h-5 w-5 text-indigo-400" />
                    ) : (
                      <Plug className="h-5 w-5 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{meta.label}</p>
                      {meta.comingSoon && (
                        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-white/30">
                          Coming soon
                        </span>
                      )}
                      {item.connected && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/40">{meta.description}</p>
                    {item.connected && item.provider_email && (
                      <p className="mt-1 text-xs text-white/30">
                        {item.provider_email} · Connected {fmtDate(item.connected_at)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.connected ? (
                      <Button size="sm" variant="secondary" onClick={() => disconnect(item.provider)}>
                        Disconnect
                      </Button>
                    ) : meta.comingSoon ? (
                      <Button size="sm" variant="secondary" disabled>
                        Connect <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          // OAuth flows handled externally; placeholder alert
                          window.alert("OAuth flow — configure GOOGLE_CLIENT_ID + redirect URI in your deployment settings, then implement the callback at /oauth/google/callback.");
                        }}
                      >
                        Connect <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-white/20">
        More integrations coming soon — LMS, Google Drive, Calendars.
      </p>
    </SettingsLayout>
  );
}
