"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Book,
  BoxSelect,
  CircleDot,
  Command as CommandIcon,
  FolderKanban,
  Gauge,
  Globe2,
  Inbox,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  Palette,
  Puzzle,
  Save,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  CommandPalette,
  OfflineBanner,
  Spinner,
  Tooltip,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
};

const NAV: NavItem[] = [
  { href: "", label: "Overview", icon: <Gauge size={16} />, shortcut: "g o" },
  { href: "/domains", label: "Domains", icon: <Globe2 size={16} />, shortcut: "g d" },
  { href: "/mailboxes", label: "Mailboxes", icon: <Mail size={16} />, shortcut: "g m" },
  { href: "/aliases", label: "Aliases", icon: <Link2 size={16} /> },
  { href: "/queue", label: "Queue", icon: <Inbox size={16} /> },
  { href: "/deliverability", label: "Deliverability", icon: <CircleDot size={16} /> },
  { href: "/security", label: "Security", icon: <ShieldCheck size={16} /> },
  { href: "/backups", label: "Backups", icon: <BoxSelect size={16} /> },
  { href: "/team", label: "Team", icon: <Users size={16} /> },
  { href: "/api-keys", label: "API keys", icon: <KeyRound size={16} /> },
  { href: "/webhooks", label: "Webhooks", icon: <Webhook size={16} /> },
  { href: "/plugins", label: "Plugins", icon: <Puzzle size={16} /> },
  { href: "/themes", label: "Themes", icon: <Palette size={16} /> },
  { href: "/developers", label: "Developers", icon: <Book size={16} /> },
  { href: "/audit", label: "Audit log", icon: <FolderKanban size={16} /> },
  { href: "/settings", label: "Settings", icon: <Save size={16} /> },
];

export default function OrgLayout({ children }: { children: ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const path = usePathname();
  const router = useRouter();
  const me = useMe();
  const [cmdOpen, setCmdOpen] = useState(false);

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

  if (!me.data) {
    return (
      <main className="min-h-screen grid place-items-center">
        <Spinner size={22} />
      </main>
    );
  }

  const currentOrg =
    me.data.orgs.find((o) => o.id === orgId) ?? me.data.orgs[0];
  const orgBase = `/orgs/${orgId}`;

  const paletteItems = NAV.map((n) => ({
    id: `nav-${n.href}`,
    label: n.label,
    section: "Navigate",
    icon: n.icon,
    shortcut: n.shortcut,
    perform: () => router.push(`${orgBase}${n.href}`),
  })).concat([
    {
      id: "sign-out",
      label: "Sign out",
      section: "Account",
      icon: <LogOut size={16} />,
      shortcut: undefined,
      perform: () => logout.mutate(),
    },
  ]);

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "260px 1fr" }}>
      <OfflineBanner />
      <aside className="border-r border-[var(--color-border)] bg-[var(--color-neutral-100)] p-4 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-500)] grid place-items-center font-bold text-white">
            J
          </div>
          <div>
            <div className="text-sm font-semibold">JustMail</div>
            <div className="text-[11px] text-[var(--color-neutral-900)]">
              Control plane
            </div>
          </div>
        </div>

        {me.data.orgs.length > 0 && (
          <select
            value={orgId}
            onChange={(e) => router.push(`/orgs/${e.target.value}`)}
            className="mb-4 w-full rounded-md bg-[var(--color-neutral-200)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
            aria-label="Organization"
          >
            {me.data.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="mb-4 justify-between"
          onClick={() => setCmdOpen(true)}
          leadingIcon={<CommandIcon size={14} />}
        >
          <span className="flex-1 text-left">Command palette</span>
          <span className="text-[10px] text-[var(--color-neutral-900)]">⌘ K</span>
        </Button>

        <nav className="space-y-0.5 flex-1" aria-label="Sections">
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
                className="nav-item"
                aria-current={active ? "page" : undefined}
              >
                <span className="text-[var(--color-neutral-900)] w-4 flex justify-center">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] font-mono text-[var(--color-neutral-700)]">
                    {item.shortcut}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center gap-3">
          <Avatar name={me.data.name || me.data.email} size={30} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {me.data.name || me.data.email}
            </div>
            {currentOrg && (
              <div className="mt-0.5">
                <Badge tone="muted">{currentOrg.role}</Badge>
              </div>
            )}
          </div>
          <Tooltip content="Sign out">
            <button
              onClick={() => logout.mutate()}
              className="p-1.5 rounded-md hover:bg-white/5 text-[var(--color-neutral-900)]"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </Tooltip>
        </div>
      </aside>

      <main className="min-h-screen bg-[var(--color-bg)] relative">
        <div className="absolute top-3 right-4 flex items-center gap-1">
          <Tooltip content="Notifications">
            <button
              className="p-2 rounded-md hover:bg-white/5"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
          </Tooltip>
        </div>
        {children}
      </main>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={paletteItems}
      />
    </div>
  );
}
