import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/useAuth";
import { color, font } from "../ui-v2/tokens";
import { useViewport } from "../ui-v2/useViewport";
import { Card, Toast } from "../ui-v2/primitives";

interface LoyaltyStatus {
  total_points: number; lifetime_points: number; current_tier: string; tier_name: string; bonus_multiplier: number;
  next_tier: string | null; points_to_next_tier: number | null; tier_benefits: Record<string, any>;
  available_rewards: Array<{ points_cost: number; reward_type: string; label: string; can_redeem: boolean }>;
  all_tiers: Record<string, any>; history: Array<any>;
}
interface ReferralStats {
  referral_code: string; referral_url: string; share_text: string; total_referrals: number; successful_referrals: number;
  total_earnings: number; earnings_this_month: number; earnings_remaining_this_month: number; monthly_cap: number;
  referrals: Array<{ id: string; status: string; signed_up_at?: string; reward_given: boolean; reward_amount: number }>;
}

export default function RewardsPage() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const { accessToken } = useAuth();
  const initialTab = router.query.tab === "referral" ? "referral" : "loyalty";
  const [tab, setTab] = useState<"loyalty" | "referral">(initialTab);

  const [status, setStatus] = useState<LoyaltyStatus | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loyaltyError, setLoyaltyError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/loyalty/status", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.status === 401) { router.push("/auth/login"); return; }
      if (!response.ok) throw new Error("Failed to fetch loyalty status");
      setStatus(await response.json());
    } catch (err) {
      setLoyaltyError(err instanceof Error ? err.message : "Error loading");
    } finally {
      setLoyaltyLoading(false);
    }
  }, [accessToken, router]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const showToast = (text: string) => { setToast(text); setTimeout(() => setToast(null), 2600); };

  const handleRedeem = async (pointsCost: number, rewardType: string) => {
    try {
      const response = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ points_amount: pointsCost, reward_type: rewardType }),
      });
      if (response.ok) { fetchStatus(); showToast("Reward redeemed successfully"); }
      else showToast("Failed to redeem reward");
    } catch {
      showToast("Error redeeming reward");
    }
  };

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState("");

  const fetchStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/referral/stats", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.status === 401) { router.push("/auth/login"); return; }
      if (!response.ok) throw new Error("Failed to fetch referral stats");
      setStats(await response.json());
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Error loading");
    } finally {
      setRefLoading(false);
    }
  }, [accessToken, router]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCopyLink = () => {
    if (stats?.referral_url) { navigator.clipboard.writeText(stats.referral_url); showToast("Referral link copied"); }
  };
  const handleShareViaEmail = () => {
    if (!stats?.referral_url) return;
    const subject = "Join LearnPath AI - Get 500 Credit";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(stats.share_text)}`;
  };
  const handleShareViaWhatsApp = () => {
    if (!stats?.referral_url) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(stats.share_text)}`, "_blank");
  };

  const tierProgress = status?.points_to_next_tier
    ? Math.round(((status.lifetime_points - (status.all_tiers[status.current_tier]?.min_points || 0)) / status.points_to_next_tier) * 100)
    : 100;

  return (
    <>
      <Head><title>Rewards — LearnPath AI</title></Head>
      <div style={{ maxWidth: 700, fontFamily: font.body }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Rewards</h1>

        <Card padding="lg" dark style={{ marginTop: 20, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.chromeTextFaint, marginBottom: 6 }}>Your balance</div>
            <div style={{ fontFamily: font.mono, fontSize: 30, fontWeight: 600 }}>{status?.total_points != null ? status.total_points.toLocaleString() : "—"} pts</div>
          </div>
          <div style={{ fontSize: 12.5, color: color.chromeTextMuted, maxWidth: 260 }}>Redeem points for study time bonuses, badges, and partner discounts.</div>
        </Card>

        <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 8, padding: 3, marginBottom: 22, width: "fit-content" }}>
          {(["loyalty", "referral"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); router.replace({ pathname: "/rewards", query: { tab: t } }, undefined, { shallow: true }); }} style={{ fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6, cursor: "pointer", border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? color.ink : color.textFaint }}>
              {t === "loyalty" ? "Loyalty" : "Referral"}
            </button>
          ))}
        </div>

        {tab === "loyalty" ? (
          loyaltyLoading ? <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div> :
          !status ? <div style={{ color: color.textFaint }}>{loyaltyError || "No data"}</div> : (
            <>
              <Card padding="md" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Current tier</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{status.tier_name}</span>
                  {status.points_to_next_tier && <span style={{ fontSize: 12, color: color.textFaint }}>{status.points_to_next_tier} to {status.next_tier}</span>}
                </div>
                <div style={{ height: 6, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, tierProgress)}%`, background: "#2B3A67", borderRadius: 100 }} />
                </div>
              </Card>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Redeem points</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
                {(status.available_rewards ?? []).map((reward, idx) => (
                  <Card key={idx} padding="md">
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{reward.label}</div>
                    <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 14 }}>{reward.points_cost} points</div>
                    <button onClick={() => handleRedeem(reward.points_cost, reward.reward_type)} disabled={!reward.can_redeem} style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: reward.can_redeem ? "1px solid #2B3A67" : "1px solid #CFCBC0", background: reward.can_redeem ? "#2B3A67" : "#F0EEE7", color: reward.can_redeem ? "#fff" : color.textFaint, cursor: reward.can_redeem ? "pointer" : "not-allowed" }}>Redeem</button>
                  </Card>
                ))}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Recent activity</div>
              {!status.history?.length ? <p style={{ fontSize: 13, color: color.textFaint }}>No activity yet</p> : (
                <Card padding="md">
                  {status.history.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: idx < 4 ? `1px solid ${color.borderMuted}` : "none", fontSize: 13 }}>
                      <span style={{ color: color.textFaint }}>{item.action}</span>
                      <span style={{ color: item.points > 0 ? color.success.fg : color.danger.fg, fontWeight: 600 }}>{item.points > 0 ? "+" : ""}{item.points}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )
        ) : (
          refLoading ? <div style={{ textAlign: "center", padding: 40, color: color.textFaint }}>Loading…</div> :
          !stats ? <div style={{ color: color.textFaint }}>{refError || "No data available"}</div> : (
            <>
              <Card padding="md" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Your referral code</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div onClick={handleCopyLink} style={{ flex: 1, minWidth: 220, padding: "9px 12px", border: `1px solid ${color.border}`, borderRadius: 7, background: color.surfaceMuted, fontFamily: font.mono, fontSize: 12.5, color: color.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{stats.referral_url}</div>
                  <button onClick={handleCopyLink} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer", flexShrink: 0 }}>Copy link</button>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={handleShareViaEmail} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", border: `1px solid ${color.border}`, borderRadius: 7, fontSize: 12.5, cursor: "pointer" }}>Email</button>
                  <button onClick={handleShareViaWhatsApp} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: color.success.bg, border: "none", borderRadius: 7, fontSize: 12.5, color: color.success.fg, cursor: "pointer" }}>WhatsApp</button>
                </div>
              </Card>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Your earnings</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                <Card padding="md"><div style={{ fontSize: 12, color: color.textFaint, marginBottom: 4 }}>Total earned</div><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>₦{(stats.total_earnings ?? 0).toLocaleString()}</div></Card>
                <Card padding="md"><div style={{ fontSize: 12, color: color.textFaint, marginBottom: 4 }}>This month</div><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600, color: color.success.fg }}>₦{(stats.earnings_this_month ?? 0).toLocaleString()}</div></Card>
                <Card padding="md"><div style={{ fontSize: 12, color: color.textFaint, marginBottom: 4 }}>Remaining</div><div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600, color: color.info.fg }}>₦{(stats.earnings_remaining_this_month ?? 0).toLocaleString()}</div></Card>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Referrals ({stats.total_referrals})</div>
              {!stats.referrals?.length ? <p style={{ fontSize: 13, color: color.textFaint }}>No referrals yet</p> : (
                <Card padding="md">
                  {stats.referrals.slice(0, 5).map((ref, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: idx < 4 ? `1px solid ${color.borderMuted}` : "none", fontSize: 13 }}>
                      <span>✓</span><span>Referral {idx + 1}</span>
                      <span style={{ marginLeft: "auto", color: color.success.fg }}>₦{ref.reward_amount}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )
        )}
      </div>
      {toast && <Toast text={toast} />}
    </>
  );
}
