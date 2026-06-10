import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { CreditCard, Zap, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Button, Card, Skeleton } from "../../../components/ui";
import SettingsLayout from "../../../components/Teacher/SettingsLayout";

interface UsageItem { label: string; value: number; max: number; unit?: string }

interface BillingData {
  subscription: {
    plan_type: string;
    plan_name: string;
    billing_cycle: string;
    renewal_date: string | null;
    status: string;
  } | null;
  usage: {
    num_classes: number; max_classes: number;
    num_students: number; max_students: number;
    storage_gb: number; max_storage_gb: number;
    num_videos: number; max_videos: number;
  } | null;
  invoices: Array<{ billing_date: string; amount: number; currency: string; description: string }>;
}

function UsageBar({ label, value, max, unit }: UsageItem) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white tabular-nums">
          {value}{unit} / {max}{unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/settings/billing", { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .finally(() => setLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  return (
    <SettingsLayout>
      <Head><title>Billing — Settings</title></Head>
      {loading ? (
        <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : (
        <div className="space-y-5">

          {/* Current plan */}
          <Card padding="md">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Current Plan</h2>
            </div>
            {data?.subscription ? (
              <div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-lg font-bold text-white">{data.subscription.plan_name}</p>
                    <p className="text-xs text-white/40 capitalize">
                      {data.subscription.billing_cycle} · renews {fmtDate(data.subscription.renewal_date)}
                    </p>
                  </div>
                  {data.subscription.plan_type !== "premium" && (
                    <Button size="sm" className="ml-auto" onClick={() => router.push("/billing")}>
                      <Zap className="mr-1.5 h-4 w-4" /> Upgrade
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">Free plan · limited features</p>
                <Button size="sm" onClick={() => router.push("/billing")}>
                  <ArrowUpRight className="mr-1.5 h-4 w-4" /> View plans
                </Button>
              </div>
            )}
          </Card>

          {/* Usage */}
          {data?.usage && (
            <Card padding="md">
              <h2 className="mb-3 text-sm font-semibold text-white">Usage</h2>
              <div className="space-y-3">
                <UsageBar label="Classes" value={data.usage.num_classes} max={data.usage.max_classes} />
                <UsageBar label="Students" value={data.usage.num_students} max={data.usage.max_students} />
                <UsageBar label="Storage" value={data.usage.storage_gb} max={data.usage.max_storage_gb} unit=" GB" />
                <UsageBar label="Videos" value={data.usage.num_videos} max={data.usage.max_videos} />
              </div>
            </Card>
          )}

          {/* Invoices */}
          <Card padding="md">
            <h2 className="mb-3 text-sm font-semibold text-white">Billing History</h2>
            {!data?.invoices.length ? (
              <p className="text-sm text-white/40">No billing history yet.</p>
            ) : (
              <div className="space-y-2">
                {data.invoices.map((inv, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white/70">{inv.description || "Subscription charge"}</p>
                      <p className="text-xs text-white/30">{fmtDate(inv.billing_date)}</p>
                    </div>
                    <p className="font-medium text-white tabular-nums">
                      {inv.currency} {inv.amount?.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push("/billing")}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
            >
              Manage billing & payments →
            </button>
          </Card>

        </div>
      )}
    </SettingsLayout>
  );
}
