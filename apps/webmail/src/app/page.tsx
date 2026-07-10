"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Mailbox } from "@justmail/contracts";
import { Spinner, Card, PageBody, PageHeader, Empty } from "@justmail/shared-ui";
import Link from "next/link";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

export default function WebmailIndex() {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.data === null) router.replace("/login");
  }, [me.data, router]);

  const orgId = me.data?.orgs[0]?.id;
  const mailboxes = useQuery({
    queryKey: ["mailboxes", orgId],
    enabled: !!orgId,
    queryFn: () => api.get<Mailbox[]>(`/v1/orgs/${orgId}/mailboxes`),
  });

  if (!me.data)
    return (
      <main className="min-h-screen grid place-items-center">
        <Spinner size={22} />
      </main>
    );

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Choose a mailbox"
        description="Pick a mailbox to open. We store the mailbox password sealed to your session."
      />
      <PageBody>
        {!mailboxes.data ? (
          <Spinner size={20} />
        ) : mailboxes.data.length === 0 ? (
          <Empty title="No mailboxes available" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mailboxes.data.map((m) => (
              <Link key={m.id} href={`/m/${m.id}`}>
                <Card className="p-4 hover:border-[var(--color-border-strong)] transition-colors">
                  <div className="mono text-sm text-[var(--color-brand-400)]">
                    {m.address}
                  </div>
                  {m.name && (
                    <div className="text-xs text-[var(--color-neutral-900)] mt-1">
                      {m.name}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-[var(--color-neutral-700)]">
                    {m.quota_mb} MB quota · {m.status}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </main>
  );
}
