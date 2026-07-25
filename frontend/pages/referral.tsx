import { useEffect } from "react";
import { useRouter } from "next/router";

// Referral is now a tab inside /rewards (Rewards.dc.html merges Loyalty +
// Referral into one page) rather than its own route.
export default function ReferralRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/rewards?tab=referral"); }, [router]);
  return null;
}
