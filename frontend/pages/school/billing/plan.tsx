import { useEffect } from "react";
import { useRouter } from "next/router";

export default function BillingPlanRedirect() {
  const router = useRouter();
  useEffect(() => { void router.replace("/school/billing?tab=plan"); }, [router]);
  return null;
}
