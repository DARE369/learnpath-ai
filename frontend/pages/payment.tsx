import { useEffect } from "react";
import { useRouter } from "next/router";

// Checkout is now a stage inside /billing (Learner Billing.dc.html merges
// Plan & Usage + Checkout into one page) rather than its own route.
export default function PaymentRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const { plan, cycle } = router.query;
    router.replace({ pathname: "/billing", query: { plan, cycle } });
  }, [router]);
  return null;
}
