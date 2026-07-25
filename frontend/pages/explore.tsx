import { useEffect } from "react";
import { useRouter } from "next/router";

// Explore is now the "Explore" tab inside /paths (Paths.dc.html merges
// Explore + Guided-paths + catalog browsing into one page) rather than its
// own route. Query params (q, autorun) pass straight through so existing
// "Start course" / autorun links keep working.
export default function ExploreRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    router.replace({ pathname: "/paths", query: router.query });
  }, [router]);
  return null;
}
