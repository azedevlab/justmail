"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, Spinner } from "@justmail/shared-ui";
import { useMe } from "@/lib/session";

export default function WebmailIndex() {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.data === null) router.replace("/login");
    // A webmail session is always bound to a single mailbox — open it directly.
    else if (me.data?.mailbox_id) router.replace(`/m/${me.data.mailbox_id}`);
    // A session without a bound mailbox is not a webmail session (e.g. a console
    // login); send it back to sign in rather than exposing other mailboxes.
    else if (me.data) router.replace("/login");
  }, [me.data, router]);

  if (me.isError)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm font-medium text-[var(--color-neutral-1100)]">
            Couldn&apos;t reach JustMail
          </p>
          <p className="text-xs text-[var(--color-neutral-800)]">
            Your session couldn&apos;t be verified. Check your connection and
            retry, or sign in again.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button variant="primary" onClick={() => me.refetch()}>
              Retry
            </Button>
            <Button variant="secondary" onClick={() => router.replace("/login")}>
              Sign in
            </Button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen grid place-items-center">
      <Spinner size={22} />
    </main>
  );
}
