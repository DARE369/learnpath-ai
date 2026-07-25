import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TeachersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/school/roster?tab=teachers");
  }, [router]);
  return null;
}
