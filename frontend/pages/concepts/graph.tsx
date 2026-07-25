import { useEffect } from "react";
import { useRouter } from "next/router";

// The graph is now a view mode inside /concepts (Concepts.dc.html merges
// List/Grid/Graph into one page) rather than its own route.
export default function ConceptGraphRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/concepts"); }, [router]);
  return null;
}
