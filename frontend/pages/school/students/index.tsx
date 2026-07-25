import { useEffect } from "react";
import { useRouter } from "next/router";

export default function StudentsRedirect() {
  const router = useRouter();
  useEffect(() => {
    const filter = typeof router.query.filter === "string" ? `&filter=${router.query.filter}` : "";
    router.replace(`/school/roster?tab=students${filter}`);
  }, [router]);
  return null;
}
