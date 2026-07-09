"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "../lib/session";

export default function Home() {
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
    <main className="min-h-screen grid place-items-center text-sm text-[var(--color-ink-300)]">
      <div className="animate-pulse">Loading…</div>
    </main>
  );
}
