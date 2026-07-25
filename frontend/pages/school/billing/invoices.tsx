import { useEffect } from "react";
import { useRouter } from "next/router";

export default function BillingInvoicesRedirect() {
  const router = useRouter();
  useEffect(() => { void router.replace("/school/billing?tab=invoices"); }, [router]);
  return null;
}
