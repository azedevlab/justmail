"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { api } from "../../../lib/api";
import { useMe } from "../../../lib/session";

const NAV = [
  { href: "", label: "Overview", icon: "◎" },
  { href: "/domains", label: "Domains", icon: "◈" },
  { href: "/mailboxes", label: "Mailboxes", icon: "✉" },
  { href: "/webmail", label: "Webmail", icon: "◇" },
  { href: "/aliases", label: "Aliases", icon: "↣" },
  { href: "/queue", label: "Queue", icon: "≡" },
  { href: "/security", label: "Security", icon: "◉" },
  { href: "/backups", label: "Backups", icon: "⬒" },
  { href: "/team", label: "Team", icon: "◐" },
  { href: "/api-keys", label: "API keys", icon: "⚿" },
  { href: "/webhooks", label: "Webhooks", icon: "⇢" },
  { href: "/developers", label: "Developers", icon: "⌘" },
  { href: "/settings", label: "Settings", icon: "✦" },
];

export default function OrgLayout({ children }: { children: ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const path = usePathname();
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.data === null) router.replace("/login");
  }, [me.data, router]);

  const logout = useMutation({
    mutationFn: () => api.post("/v1/auth/logout"),
    onSuccess: () => {
      me.refetch();
      router.replace("/login");
    },
  });

  if (!me.data) return null;
  const currentOrg = me.data.orgs.find((o) => o.id === orgId) ?? me.data.orgs[0];
  const orgBase = `/orgs/${orgId}`;

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "260px 1fr" }}>
      <aside className="border-r border-white/5 bg-[var(--color-ink-900)] p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-500)] grid place-items-center font-bold text-white">
            J
          </div>
          <div>
            <div className="text-sm font-semibold">JustMail</div>
            <div className="text-xs text-[var(--color-ink-400)]">Control plane</div>
          </div>
        </div>

        {me.data.orgs.length > 0 && (
          <select
            className="select mb-4"
            value={orgId}
            onChange={(e) => router.push(`/orgs/${e.target.value}`)}
          >
            {me.data.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        <nav className="space-y-1 flex-1">
          {NAV.map((item) => {
            const href = `${orgBase}${item.href}`;
            const active =
              item.href === ""
                ? path === orgBase
                : path === href || path.startsWith(href + "/");
            return (
              <Link
                key={item.href}
                href={href}
                className={
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition " +
                  (active
                    ? "bg-[rgb(124_92_255/0.1)] text-[var(--color-brand-400)] border border-[rgb(124_92_255/0.2)]"
                    : "text-[var(--color-ink-200)] hover:bg-white/5 border border-transparent")
                }
              >
                <span className="text-[var(--color-ink-400)] w-4 text-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
          <div className="px-3 py-2 text-xs">
            <div className="text-[var(--color-ink-200)] font-medium">
              {me.data.name}
            </div>
            <div className="text-[var(--color-ink-400)] mono">{me.data.email}</div>
            {currentOrg && (
              <div className="mt-1">
                <span className="badge badge-muted">{currentOrg.role}</span>
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary w-full"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-h-screen">{children}</main>
    </div>
  );
}
