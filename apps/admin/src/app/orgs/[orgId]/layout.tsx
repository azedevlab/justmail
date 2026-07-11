"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  Book,
  Check,
  ChevronsUpDown,
  CircleDot,
  FileClock,
  Fingerprint,
  Gavel,
  Globe2,
  HardDrive,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Menu,
  Network,
  Palette,
  Puzzle,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Webhook,
  X,
} from "lucide-react";
import {
  Avatar,
  Button,
  CommandPalette,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  IconButton,
  OfflineBanner,
  Spinner,
  ThemeToggle,
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
      { href: "/groups", label: "Groups", icon: <Users size={15} /> },
      { href: "/queue", label: "Queue", icon: <Inbox size={15} /> },
      { href: "/deliverability", label: "Deliverability", icon: <CircleDot size={15} /> },
    ],
  },
  {
    label: "Protect",
    items: [
      { href: "/security", label: "Security", icon: <ShieldCheck size={15} /> },
      { href: "/sso", label: "SSO", icon: <Fingerprint size={15} /> },
      { href: "/ldap", label: "Directory", icon: <Network size={15} /> },
      { href: "/scim", label: "Provisioning", icon: <UserCog size={15} /> },
      { href: "/backups", label: "Backups", icon: <Archive size={15} /> },
      { href: "/retention", label: "Retention", icon: <Gavel size={15} /> },
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
      { href: "/quota", label: "Storage", icon: <HardDrive size={15} /> },
      { href: "/settings", label: "Settings", icon: <Settings size={15} /> },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationsMenu({ orgId }: { orgId: string }) {
  const router = useRouter();
  const recent = useQuery({
    queryKey: ["audit-recent", orgId],
    queryFn: () =>
      api
        .get<
          { id: string; action: string; target_type: string | null; created_at: string }[]
        >(`/v1/orgs/${orgId}/audit?limit=8`)
        .catch(() => []),
    refetchInterval: 60_000,
  });
  return (
    <DropdownMenu
      trigger={
        <IconButton aria-label="Recent activity">
          <Bell size={15} />
        </IconButton>
      }
    >
      <DropdownLabel>Recent activity</DropdownLabel>
      {(recent.data ?? []).length === 0 && (
        <div className="px-3 py-4 text-xs text-[var(--color-neutral-800)]">
          Nothing yet — actions across the org land here.
        </div>
      )}
      {(recent.data ?? []).map((e) => (
        <DropdownItem
          key={e.id}
          onSelect={() => router.push(`/orgs/${orgId}/audit`)}
        >
          <span className="flex-1 min-w-0">
            <span className="block mono text-xs truncate">{e.action}</span>
            <span className="block text-[11px] text-[var(--color-neutral-800)]">
              {e.target_type ?? "org"} · {timeAgo(e.created_at)}
            </span>
          </span>
        </DropdownItem>
      ))}
      <DropdownSeparator />
      <DropdownItem onSelect={() => router.push(`/orgs/${orgId}/audit`)}>
        <FileClock size={14} /> View audit log
      </DropdownItem>
    </DropdownMenu>
  );
}

export default function OrgLayout({ children }: { children: ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const path = usePathname();
  const router = useRouter();
  const me = useMe();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (me.data === null) router.replace("/login");
  }, [me.data, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  const logout = useMutation({
    mutationFn: () => api.post("/v1/auth/logout"),
    onSuccess: () => {
      me.refetch();
      router.replace("/login");
    },
  });

  if (me.isError) {
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
  }

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

  const sidebar = (
    <>
      <div className="px-1.5 mb-4 flex items-center justify-between">
        <Link href={orgBase} aria-label="JustMail overview">
          <Wordmark size={30} sub="Control plane" />
        </Link>
        <IconButton
          aria-label="Close menu"
          className="lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <X size={16} />
        </IconButton>
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
              {o.id === orgId && <Check size={14} className="text-[var(--color-accent)]" />}
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
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] lg:flex">
      <OfflineBanner />

      {/* Floating sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-[248px] shrink-0 sticky top-3 h-[calc(100vh-24px)] my-3 ml-3 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-[var(--shadow-2)] px-3 py-4 overflow-y-auto">
        {sidebar}
      </aside>

      {/* Mobile sheet */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[var(--z-overlay)]">
          <div
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[4px]"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[264px] flex flex-col bg-[var(--color-surface-1)] shadow-[var(--shadow-4)] px-3 py-4 overflow-y-auto animate-in slide-in-from-left-4 fade-in-0 duration-200">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-h-screen flex flex-col flex-1 min-w-0">
        <header className="h-[52px] shrink-0 border-b border-[var(--color-border)] flex items-center gap-3 px-4 sticky top-0 z-[var(--z-raised)] glass">
          <IconButton
            aria-label="Open menu"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={16} />
          </IconButton>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0">
            {currentOrg && (
              <span className="text-[var(--color-neutral-800)] truncate hidden sm:inline">
                {currentOrg.name}
              </span>
            )}
            <span className="text-[var(--color-neutral-600)] hidden sm:inline">/</span>
            <span className="font-medium text-[var(--color-neutral-1100)] truncate">
              {activeItem?.label ?? "Overview"}
            </span>
          </nav>

          <div className="flex-1" />

          <button
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex items-center gap-2 w-56 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-[13px] text-[var(--color-neutral-800)] hover:border-[var(--color-accent-hover)] transition-colors shadow-[var(--shadow-inset-input)]"
            aria-label="Open command palette"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="px-1 py-px rounded bg-[var(--hover-overlay)] border border-[var(--color-border)] font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          <IconButton
            aria-label="Search"
            className="md:hidden"
            onClick={() => setCmdOpen(true)}
          >
            <Search size={15} />
          </IconButton>

          <Tooltip content="Appearance">
            <span>
              <ThemeToggle />
            </span>
          </Tooltip>

          <Tooltip content="Recent activity">
            <span>
              <NotificationsMenu orgId={orgId} />
            </span>
          </Tooltip>

          <DropdownMenu
            trigger={
              <button className="rounded-full ring-1 ring-[var(--color-border-strong)] hover:ring-[var(--color-accent-ring)] transition-shadow" aria-label="Account menu">
                <Avatar name={me.data.name || me.data.email} size={28} />
              </button>
            }
          >
            <DropdownLabel>{me.data.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => router.push(`${orgBase}/account`)}>
              <ShieldCheck size={14} /> Account & security
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => logout.mutate()} destructive>
              <LogOut size={14} /> Sign out
            </DropdownItem>
          </DropdownMenu>
        </header>

        <main className="flex-1 min-h-0 w-full max-w-[1200px] mx-auto">
          {children}
        </main>
      </div>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        items={paletteItems}
      />
    </div>
  );
}
