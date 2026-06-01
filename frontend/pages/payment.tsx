import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import {
  CreditCard,
  Shield,
  Check,
  AlertCircle,
  Loader2,
  Banknote,
  Smartphone,
  Hash,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const NAIRA = "₦";

interface CatalogPlan {
  plan_type: string;
  name: string;
  price: number;
  yearly_price: number;
  videos_per_month: number;
  hours_per_month: number;
  questions_per_day: number;
  features: string[];
}

const METHODS = [
  { id: "card", label: "Debit / Credit card", icon: CreditCard },
  { id: "bank_transfer", label: "Bank transfer", icon: Banknote },
  { id: "ussd", label: "USSD", icon: Hash },
  { id: "mobile_money", label: "Mobile money", icon: Smartphone },
];

function fmtMoney(n: number): string {
  return `${NAIRA}${n.toLocaleString()}`;
}

export default function PaymentPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [plan, setPlan] = useState<CatalogPlan | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState<string>("card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  useEffect(() => {
    if (!router.isReady) return;
    const planType = (router.query.plan as string) || "pro";
    const queryCycle = (router.query.cycle as string) === "yearly" ? "yearly" : "monthly";
    setCycle(queryCycle);
    (async () => {
      try {
        const res = await axios.get("/api/subscriptions/plans");
        const found = (res.data.plans || []).find((p: CatalogPlan) => p.plan_type === planType);
        if (!found || planType === "free") {
          setError("That plan isn't available for purchase.");
        } else {
          setPlan(found);
        }
      } catch {
        setError("Couldn't load plan details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router.isReady, router.query.plan, router.query.cycle]);

  const amount = useMemo(() => {
    if (!plan) return 0;
    return cycle === "yearly" ? plan.yearly_price : plan.price;
  }, [plan, cycle]);

  async function handleProceed() {
    if (!plan || !accessToken) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await axios.post(
        "/api/payments/initialize",
        { plan_type: plan.plan_type, billing_cycle: cycle },
        { headers: authHeader },
      );
      const link = res.data.payment_link;
      if (link) {
        window.location.href = link;
      } else {
        setError("Payment could not be started. Please try again.");
        setProcessing(false);
      }
    } catch (err: unknown) {
      let message = "We couldn't start your payment. Please try again.";
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: string })?.detail;
        if (detail) message = detail;
      }
      setError(message);
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Checkout — LearnPath AI</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to billing
        </button>

        <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Complete your upgrade</h1>
        <p className="text-white/50 mb-8">Review your plan and choose how you&apos;d like to pay.</p>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error-muted p-4 text-error">
            <AlertCircle size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {plan && (
          <div className="space-y-6">
            {/* Plan summary */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <div className="inline-flex rounded-lg bg-surface-hover p-1 text-xs">
                  {(["monthly", "yearly"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors ${
                        cycle === c ? "bg-gradient-accent text-white" : "text-white/50 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> {plan.videos_per_month >= 999999 ? "Unlimited" : plan.videos_per_month} videos / month</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> {plan.hours_per_month >= 999999 ? "Unlimited" : plan.hours_per_month} hours / month</li>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 capitalize">
                    <Check size={14} className="text-success" /> {f.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
              {cycle === "yearly" && (
                <p className="mt-3 text-xs text-success">2 months free with annual billing</p>
              )}
            </section>

            {/* Payment method */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Payment method</h2>
              <div className="grid grid-cols-2 gap-3">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                        active ? "border-accent bg-accent-muted" : "border-border bg-surface hover:bg-surface-hover"
                      }`}
                    >
                      <Icon size={20} className={active ? "text-accent-light" : "text-white/50"} />
                      <span className="text-sm text-white">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-white/30">
                You&apos;ll choose and confirm your exact payment details securely on Flutterwave.
              </p>
            </section>

            {/* Total + action */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-white/60">Total due today</span>
                <span className="text-2xl font-bold text-white">{fmtMoney(amount)}</span>
              </div>
              <button
                type="button"
                onClick={handleProceed}
                disabled={processing}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Redirecting…
                  </>
                ) : (
                  <>
                    <Shield size={18} /> Proceed to secure payment
                  </>
                )}
              </button>
              <p className="flex items-center justify-center gap-2 text-xs text-white/30 mt-4">
                <Shield size={13} /> 256-bit encrypted · Powered by Flutterwave
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
