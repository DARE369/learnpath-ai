import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ClassesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/school/roster?tab=classes");
  }, [router]);
  return null;
}
