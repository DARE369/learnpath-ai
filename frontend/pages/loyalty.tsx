import { useEffect } from "react";
import { useRouter } from "next/router";

// Loyalty is now a tab inside /rewards (Rewards.dc.html merges Loyalty +
// Referral into one page) rather than its own route.
export default function LoyaltyRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/rewards?tab=loyalty"); }, [router]);
  return null;
}
