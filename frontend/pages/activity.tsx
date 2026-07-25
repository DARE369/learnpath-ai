import { useEffect } from "react";
import { useRouter } from "next/router";

// Activity is now a tab inside /history (History.dc.html merges Activity +
// Achievements into one page) rather than its own route.
export default function ActivityRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/history?tab=activity"); }, [router]);
  return null;
}
