"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  Book,
  Check,
  ChevronsUpDown,
  CircleDot,
  FileClock,
  Globe2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Palette,
  Puzzle,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import {
  Avatar,
  CommandPalette,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  OfflineBanner,
  Spinner,
  Tooltip,
  Wordmark,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
};

type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "", label: "Overview", icon: <LayoutDashboard size={15} />, shortcut: "g o" },
    ],
  },
  {
    label: "Mail",
    items: [
      { href: "/domains", label: "Domains", icon: <Globe2 size={15} />, shortcut: "g d" },
      { href: "/mailboxes", label: "Mailboxes", icon: <Mail size={15} />, shortcut: "g m" },
      { href: "/aliases", label: "Aliases", icon: <Link2 size={15} /> },
      { href: "/queue", label: "Queue", icon: <Inbox size={15} /> },
      { href: "/deliverability", label: "Deliverability", icon: <CircleDot size={15} /> },
    ],
  },
  {
    label: "Protect",
    items: [
      { href: "/security", label: "Security", icon: <ShieldCheck size={15} /> },
      { href: "/backups", label: "Backups", icon: <Archive size={15} /> },
      { href: "/audit", label: "Audit log", icon: <FileClock size={15} /> },
    ],
  },
  {
    label: "Extend",
    items: [
      { href: "/webhooks", label: "Webhooks", icon: <Webhook size={15} /> },
      { href: "/api-keys", label: "API keys", icon: <KeyRound size={15} /> },
      { href: "/plugins", label: "Plugins", icon: <Puzzle size={15} /> },
      { href: "/themes", label: "Themes", icon: <Palette size={15} /> },
      { href: "/developers", label: "Developers", icon: <Book size={15} /> },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/team", label: "Team", icon: <Users size={15} /> },
      { href: "/settings", label: "Settings", icon: <Settings size={15} /> },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

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
  const activeItem = ALL_NAV.find((n) =>
    n.href === ""
      ? path === orgBase
      : path === `${orgBase}${n.href}` || path.startsWith(`${orgBase}${n.href}/`),
  );

  const paletteItems = ALL_NAV.map((n) => ({
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
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <OfflineBanner />

      <aside className="border-r border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-4 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="px-1.5 mb-4">
          <Link href={orgBase} aria-label="JustMail overview">
            <Wordmark size={30} sub="Control plane" />
          </Link>
        </div>

        {currentOrg && (
          <DropdownMenu
            align="start"
            trigger={
              <button
                className="mb-1 w-full flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-2 text-left hover:border-[var(--color-border-strong)] transition-colors"
                aria-label="Switch organization"
              >
                <Avatar name={currentOrg.name} size={22} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">
                    {currentOrg.name}
                  </span>
                  <span className="block text-[11px] text-[var(--color-neutral-800)] capitalize">
                    {currentOrg.role}
                  </span>
                </span>
                <ChevronsUpDown size={14} className="text-[var(--color-neutral-700)] shrink-0" />
              </button>
            }
          >
            <DropdownLabel>Organizations</DropdownLabel>
            {me.data.orgs.map((o) => (
              <DropdownItem key={o.id} onSelect={() => router.push(`/orgs/${o.id}`)}>
                <Avatar name={o.name} size={18} />
                <span className="flex-1 truncate">{o.name}</span>
                {o.id === orgId && <Check size={14} className="text-[var(--color-brand-400)]" />}
              </DropdownItem>
            ))}
          </DropdownMenu>
        )}

        <nav className="flex-1" aria-label="Sections">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? "root"}>
              {group.label && <div className="nav-group-label">{group.label}</div>}
              {!group.label && <div className="mt-3" />}
              <div className="space-y-px">
                {group.items.map((item) => {
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
                      <span className="nav-icon text-[var(--color-neutral-800)] w-4 flex justify-center">
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 pt-3 border-t border-[var(--color-border)] px-1.5 text-[11px] text-[var(--color-neutral-700)]">
          JustMail · AGPL-3.0
        </div>
      </aside>

      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 shrink-0 border-b border-[var(--color-border)] flex items-center gap-3 px-4 sticky top-0 z-[var(--z-raised)] bg-[color:rgb(8_9_12/0.85)] backdrop-blur-md">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
            {currentOrg && (
              <span className="text-[var(--color-neutral-800)] truncate">{currentOrg.name}</span>
            )}
            <span className="text-[var(--color-neutral-600)]">/</span>
            <span className="font-medium text-[var(--color-neutral-1100)] truncate">
              {activeItem?.label ?? "Overview"}
            </span>
          </nav>

          <div className="flex-1" />

          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-[13px] text-[var(--color-neutral-800)] hover:border-[var(--color-border-strong)] transition-colors"
            aria-label="Open command palette"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="px-1 py-px rounded bg-white/5 border border-[var(--color-border)] font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <Tooltip content="Notifications">
            <button
              className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-white/[0.06] hover:text-[var(--color-neutral-1100)] transition-colors"
              aria-label="Notifications"
            >
              <Bell size={15} />
            </button>
          </Tooltip>

          <DropdownMenu
            trigger={
              <button className="rounded-full ring-1 ring-[var(--color-border-strong)] hover:ring-[color:rgb(124_92_255/0.5)] transition-shadow" aria-label="Account menu">
                <Avatar name={me.data.name || me.data.email} size={28} />
              </button>
            }
          >
            <DropdownLabel>{me.data.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => logout.mutate()} destructive>
              <LogOut size={14} /> Sign out
            </DropdownItem>
          </DropdownMenu>
        </header>

        <main className="flex-1 min-h-0">{children}</main>
      </div>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={paletteItems}
      />
    </div>
  );
}
