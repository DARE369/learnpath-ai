import { useEffect } from "react";
import { useRouter } from "next/router";

// Achievements is now a tab inside /history (History.dc.html merges
// Activity + Achievements into one page) rather than its own route.
export default function AchievementsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/history?tab=achievements"); }, [router]);
  return null;
}
