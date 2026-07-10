"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@justmail/shared-ui";
import { useMe } from "@/lib/session";

export default function IndexRedirect() {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.data === null) router.replace("/login");
    else if (me.data) {
      const orgId = me.data.orgs[0]?.id;
      router.replace(orgId ? `/orgs/${orgId}` : "/login");
    }
  }, [me.data, router]);

  return (
    <main className="min-h-screen grid place-items-center">
      <Spinner size={22} />
    </main>
  );
}
