"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Mailbox } from "@justmail/contracts";
import {
  AuroraBackdrop,
  Avatar,
  Card,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  Empty,
  Spinner,
  Wordmark,
} from "@justmail/shared-ui";
import { LogOut, Mail } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLogout, useMe } from "@/lib/session";

export default function WebmailIndex() {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();

  useEffect(() => {
    if (me.data === null) router.replace("/login");
    // Mailbox-first session: bound to a single inbox — skip the picker.
    else if (me.data?.mailbox_id) router.replace(`/m/${me.data.mailbox_id}`);
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
    <main className="relative min-h-screen bg-[var(--color-bg)]">
      <AuroraBackdrop />
      <div className="absolute top-3 right-4 z-10">
        <DropdownMenu
          trigger={
            <button
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              aria-label="Account"
            >
              <Avatar name={me.data.email} size={30} />
            </button>
          }
        >
          <DropdownLabel>{me.data.email}</DropdownLabel>
          <DropdownSeparator />
          <DropdownItem destructive onSelect={() => logout.mutate()}>
            <LogOut size={14} />
            Sign out
          </DropdownItem>
        </DropdownMenu>
      </div>
      <div className="relative mx-auto max-w-3xl px-6 pt-[12vh] pb-16 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="flex justify-center mb-2">
          <Wordmark size={36} sub="Webmail" />
        </div>
        <h1 className="text-center text-lg font-semibold mt-6">
          Choose a mailbox
        </h1>
        <p className="text-center text-xs text-[var(--color-neutral-900)] mt-1 mb-8">
          Mailbox credentials are sealed to your session — never stored in the
          browser.
        </p>
        {!mailboxes.data ? (
          <div className="flex justify-center">
            <Spinner size={20} />
          </div>
        ) : mailboxes.data.length === 0 ? (
          <Empty title="No mailboxes available" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mailboxes.data.map((m) => (
              <Link key={m.id} href={`/m/${m.id}`}>
                <Card className="p-4 flex items-center gap-3 hover:border-[var(--color-accent-hover)] hover:shadow-[var(--shadow-2)] transition-all">
                  <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                    <Mail size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {m.address}
                    </span>
                    <span className="block text-xs text-[var(--color-neutral-800)] mt-0.5">
                      {m.name ? `${m.name} · ` : ""}
                      {m.quota_mb} MB · {m.status}
                    </span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
