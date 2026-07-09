"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Mailbox } from "@justmail/types";
import { api } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader } from "../../../../components/shell";

export default function WebmailIndex() {
  const { orgId } = useParams<{ orgId: string }>();
  const mailboxes = useQuery({
    queryKey: ["mailboxes", orgId],
    queryFn: () => api.get<Mailbox[]>(`/v1/orgs/${orgId}/mailboxes`),
  });

  return (
    <>
      <PageHeader
        title="Webmail"
        description="Pick a mailbox to open. The webmail auths to Dovecot with the mailbox password; store it in your session with Unlock."
      />
      <PageBody>
        {mailboxes.data && mailboxes.data.length === 0 ? (
          <EmptyState title="No mailboxes to open yet." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mailboxes.data?.map((m) => (
              <Link
                key={m.id}
                href={`/orgs/${orgId}/webmail/${m.id}`}
                className="card p-4 hover:border-white/10 border border-transparent"
              >
                <div className="mono text-sm">{m.address}</div>
                {m.name && (
                  <div className="text-xs text-[var(--color-ink-300)] mt-1">
                    {m.name}
                  </div>
                )}
                <div className="mt-2 text-xs text-[var(--color-ink-400)]">
                  {m.quota_mb} MB quota · {m.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
