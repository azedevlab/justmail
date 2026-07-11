"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Controller, useForm } from "react-hook-form";
import type {
  Folder,
  MessageList,
  MessageSummary,
  MessageSync,
  Message,
  ComposeRequest,
  SavedDraft,
  SendResult,
  SendStatus,
  Signature,
  Template,
  SieveRule,
  SieveRuleRequest,
  SieveCondition,
  SieveAction,
  SieveConditionField,
  SieveConditionOp,
  SieveActionType,
  SieveMatch,
  Upload,
  Attachment,
  Contact,
  ContactRequest,
  CalendarEvent,
  CalendarEventRequest,
} from "@justmail/contracts";
import { ApiError, useHotkey } from "@justmail/shared-utils";
import { brand, fontFamily, neutralLight } from "@justmail/design-tokens";
import {
  AuroraBackdrop,
  Avatar,
  Button,
  Card,
  Empty,
  FormField,
  IconButton,
  Input,
  KeyHint,
  Modal,
  Skeleton,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
  Tooltip,
  useToast,
  Wordmark,
  type ToastItem,
} from "@justmail/shared-ui";
import {
  Archive,
  ArrowLeft,
  Bell,
  Bold,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileText,
  Filter,
  Folder as FolderIcon,
  Forward,
  Inbox,
  Italic,
  Link2,
  List,
  ListOrdered,
  MailOpen,
  Minus,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Settings,
  Star,
  Trash2,
  Underline,
  Users,
  X,
} from "lucide-react";
import { useMe } from "@/lib/session";
import { api, API_BASE } from "@/lib/api";
import { useMailboxRealtime } from "@/lib/realtime";
import {
  enablePush,
  pushEnabled,
  pushSupported,
  registerServiceWorker,
} from "@/lib/pwa";

type ComposeInit = {
  to?: string;
  cc?: string;
  subject?: string;
  text?: string;
  in_reply_to?: string;
  references?: string[];
  // UID of an existing \Drafts message being resumed, so autosave replaces it.
  draftUid?: number;
};

// Idle delay before the search box issues a server-side IMAP SEARCH.
const SEARCH_DEBOUNCE_MS = 300;

// After the undo window elapses the worker dispatches the send asynchronously.
// Poll the send row to surface the real terminal outcome instead of leaving the
// "Sending…" toast to silently disappear.
async function confirmSendOutcome(
  orgId: string,
  mailboxId: string,
  id: string,
  toast: (t: Omit<ToastItem, "id">) => void,
  onSent: () => void,
): Promise<void> {
  const url = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/sends/${id}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const s = await api.get<SendStatus>(url);
      if (s.status === "sent") {
        toast({ title: "Message sent", tone: "ok" });
        onSent();
        return;
      }
      if (s.status === "failed") {
        toast({
          title: "Send failed",
          description: s.last_error ?? "The message could not be delivered.",
          tone: "bad",
        });
        return;
      }
      if (s.status === "cancelled") return;
    } catch {
      // Transient (row not yet visible / network) — retry.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  toast({
    title: "Still sending…",
    description: "Your message is queued and will be delivered shortly.",
    tone: "info",
  });
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

type Thread = { id: string; messages: MessageSummary[] };

// Group a newest-first message list into conversations by server thread_id,
// preserving list order. Messages without a thread_id stand alone.
function groupThreads(messages: MessageSummary[]): Thread[] {
  const order: string[] = [];
  const map = new Map<string, MessageSummary[]>();
  for (const m of messages) {
    const key = m.thread_id ?? `uid:${m.uid}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(m);
    else {
      map.set(key, [m]);
      order.push(key);
    }
  }
  return order.map((id) => ({ id, messages: map.get(id)! }));
}

// Flattened virtual rows: a thread head, plus child rows when it is expanded.
type Row =
  | { kind: "head"; thread: Thread }
  | { kind: "child"; m: MessageSummary };

export default function MailboxView() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [folder, setFolder] = useState("INBOX");
  const [openUid, setOpenUid] = useState<number | null>(null);
  const [compose, setCompose] = useState<ComposeInit | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushCapable, setPushCapable] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [listW, setListW] = useState(360);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toggleThread = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    const saved = Number(localStorage.getItem("jm.listWidth"));
    if (saved >= 280 && saved <= 560) setListW(saved);
  }, []);

  // Register the offline/push service worker and reflect the current push
  // subscription state in the toolbar toggle.
  useEffect(() => {
    registerServiceWorker();
    setPushCapable(pushSupported());
    void pushEnabled().then(setPushOn);
  }, []);

  const togglePush = async () => {
    const result = await enablePush();
    if (result === "enabled") {
      setPushOn(true);
      toast({ title: "Notifications enabled", tone: "ok" });
    } else if (result === "denied") {
      toast({ title: "Notifications blocked in browser", tone: "bad" });
    } else if (result === "unconfigured") {
      toast({ title: "Push not configured on this server", tone: "bad" });
    } else {
      toast({ title: "Push not supported here", tone: "bad" });
    }
  };

  // Debounce the search box so each keystroke doesn't fire an IMAP SEARCH.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listW;
    let w = startW;
    const move = (ev: PointerEvent) => {
      w = Math.min(560, Math.max(280, startW + ev.clientX - startX));
      setListW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      localStorage.setItem("jm.listWidth", String(w));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Keyboard resizing for the list/read splitter (WAI-ARIA separator pattern).
  const nudgeListW = (delta: number) => {
    setListW((prev) => {
      const w = Math.min(560, Math.max(280, prev + delta));
      localStorage.setItem("jm.listWidth", String(w));
      return w;
    });
  };
  const resizeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const STEP = 24;
    if (e.key === "ArrowLeft") nudgeListW(-STEP);
    else if (e.key === "ArrowRight") nudgeListW(STEP);
    else if (e.key === "Home") nudgeListW(-560);
    else if (e.key === "End") nudgeListW(560);
    else return;
    e.preventDefault();
  };

  const orgId = me.data?.orgs[0]?.id;

  const folders = useQuery({
    queryKey: ["folders", orgId, mailboxId],
    enabled: !!orgId,
    queryFn: () =>
      api.get<Folder[]>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders`,
      ),
    retry: false,
  });

  const messages = useQuery({
    queryKey: ["messages", orgId, mailboxId, folder],
    enabled: !!orgId && !!folders.data,
    queryFn: () =>
      api.get<MessageList>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages?limit=100`,
      ),
  });

  const searching = searchTerm.length > 0;
  const searchResults = useQuery({
    queryKey: ["search", orgId, mailboxId, folder, searchTerm],
    enabled: !!orgId && !!folders.data && searching,
    queryFn: () =>
      api.get<MessageList>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/search?q=${encodeURIComponent(searchTerm)}`,
      ),
  });

  const message = useQuery({
    queryKey: ["message", orgId, mailboxId, folder, openUid],
    enabled: openUid !== null,
    queryFn: () =>
      api.get<Message>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${openUid}`,
      ),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["messages", orgId, mailboxId, folder] });
    qc.invalidateQueries({ queryKey: ["search", orgId, mailboxId, folder] });
  };

  const listKey = ["messages", orgId, mailboxId, folder] as const;
  // A flag change (read/star/…) is the highest-frequency event; rather than
  // re-listing the folder, pull the CONDSTORE delta and patch flags in place.
  const syncFlags = async () => {
    const cached = qc.getQueryData<MessageList>(listKey);
    if (!cached?.mod_seq) {
      invalidate();
      return;
    }
    const params = new URLSearchParams({ since: cached.mod_seq });
    if (cached.uid_validity) params.set("uid_validity", cached.uid_validity);
    let delta: MessageSync;
    try {
      delta = await api.get<MessageSync>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/sync?${params}`,
      );
    } catch {
      invalidate();
      return;
    }
    if (delta.stale) {
      invalidate();
    } else if (delta.changed.length > 0) {
      const byUid = new Map(delta.changed.map((c) => [c.uid, c.flags]));
      qc.setQueryData<MessageList>(listKey, (prev) =>
        prev
          ? {
              ...prev,
              mod_seq: delta.mod_seq,
              messages: prev.messages.map((m) =>
                byUid.has(m.uid) ? { ...m, flags: byUid.get(m.uid)! } : m,
              ),
            }
          : prev,
      );
    } else {
      qc.setQueryData<MessageList>(listKey, (prev) =>
        prev ? { ...prev, mod_seq: delta.mod_seq } : prev,
      );
    }
    // Unread badges live in the folder query, which CONDSTORE flag deltas move.
    qc.invalidateQueries({ queryKey: ["folders", orgId, mailboxId] });
  };

  useMailboxRealtime({
    orgId,
    mailboxId,
    folder,
    enabled: !!orgId && !!folders.data,
    onChange: (event) => {
      if (event.type === "mail:flags") {
        void syncFlags();
        const uid = event.data.uid;
        if (typeof uid === "number") {
          qc.invalidateQueries({
            queryKey: ["message", orgId, mailboxId, folder, uid],
          });
        }
        return;
      }
      // mail:new / mail:expunge change the message set itself: full refresh.
      invalidate();
      qc.invalidateQueries({ queryKey: ["folders", orgId, mailboxId] });
    },
  });

  const flag = useMutation({
    mutationFn: (v: { uid: number; action: string }) =>
      api.post(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${v.uid}/flags`,
        { action: v.action },
      ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (uid: number) =>
      api.post(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${uid}/delete`,
      ),
    onSuccess: () => {
      setOpenUid(null);
      invalidate();
      toast({ title: "Deleted", tone: "ok" });
    },
  });

  const archivePath = folders.data?.find(
    (f) => (f.special_use ?? "").toLowerCase() === "\\archive",
  )?.path;
  const draftsPath = folders.data?.find(
    (f) => (f.special_use ?? "").toLowerCase() === "\\drafts",
  )?.path;

  // Opening a message in Drafts resumes it in the composer instead of the read
  // pane; everything else opens normally and clears its unread flag.
  const openMessage = async (m: MessageSummary) => {
    if (folder === draftsPath) {
      try {
        const full = await api.get<Message>(
          `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${m.uid}`,
        );
        setCompose({
          to: (full.to.match(/[\w.+-]+@[\w.-]+/g) ?? []).join(", "),
          cc: (full.cc.match(/[\w.+-]+@[\w.-]+/g) ?? []).join(", "),
          subject: full.subject,
          text: full.text,
          draftUid: m.uid,
        });
      } catch {
        toast({ title: "Could not open draft", tone: "bad" });
      }
      return;
    }
    setOpenUid(m.uid);
    if (!m.flags.includes("\\Seen")) flag.mutate({ uid: m.uid, action: "read" });
  };
  const move = useMutation({
    mutationFn: (v: { uid: number; destination: string }) =>
      api.post(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${v.uid}/move`,
        { destination: v.destination },
      ),
    onSuccess: () => {
      setOpenUid(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ["folders", orgId, mailboxId] });
      toast({ title: "Archived", tone: "ok" });
    },
  });

  const replyTo = (m: Message) => {
    const addr = m.from.match(/[\w.+-]+@[\w.-]+/)?.[0] ?? m.from;
    const subject = /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`;
    const quoted = (m.text || "")
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    const when = m.date ? new Date(m.date).toLocaleString() : "";
    const priorRefs = (m.headers?.references ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const references = m.message_id
      ? [...priorRefs, m.message_id]
      : priorRefs;
    setCompose({
      to: addr,
      subject,
      text: `\n\nOn ${when}, ${m.from} wrote:\n${quoted}`,
      in_reply_to: m.message_id ?? undefined,
      references: references.length > 0 ? references : undefined,
    });
  };
  const forwardMsg = (m: Message) => {
    const subject = /^fwd:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`;
    setCompose({
      subject,
      text: `\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nDate: ${m.date ? new Date(m.date).toLocaleString() : ""}\nSubject: ${m.subject}\nTo: ${m.to}\n\n${m.text}`,
    });
  };

  useHotkey("c", () => setCompose({}));
  useHotkey("#", () => openUid && setConfirmDelete(true), { deps: [openUid] });
  useHotkey("s", () =>
    openUid && flag.mutate({ uid: openUid, action: "star" }),
    { deps: [openUid] },
  );
  // `?` carries an implicit Shift, which useHotkey's modifier match rejects, so
  // bind it directly. Skip while typing in a field.
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)
      )
        return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // While searching, the server returns the matched set; otherwise the loaded
  // folder listing drives the list. Threading and virtualization run over
  // whichever set is active.
  const list = searching ? searchResults : messages;
  const listItems = list.data?.messages ?? [];

  const threads = useMemo(() => groupThreads(listItems), [listItems]);
  // Flatten threads into render rows: each head, plus its older messages when
  // the conversation is expanded.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const t of threads) {
      out.push({ kind: "head", thread: t });
      if (t.messages.length > 1 && expanded.has(t.id)) {
        for (const m of t.messages.slice(1)) out.push({ kind: "child", m });
      }
    }
    return out;
  }, [threads, expanded]);

  // Virtualize the message list so a folder with thousands of messages only
  // mounts the rows in view. Rows have variable height (optional preview line),
  // so measureElement corrects the estimate after mount.
  const listParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 76,
    overscan: 10,
    getItemKey: (i) => {
      const r = rows[i]!;
      return r.kind === "head" ? `h:${r.thread.id}` : `c:${r.m.uid}`;
    },
  });

  if (folders.isError && (folders.error as ApiError)?.status === 403) {
    return (
      <UnlockScreen
        orgId={orgId ?? ""}
        mailboxId={mailboxId}
        onDone={() => folders.refetch()}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Top chrome */}
      <header className="h-12 shrink-0 border-b border-[var(--color-border)] flex items-center gap-3 px-3 bg-[var(--color-surface-1)]">
        <Tooltip content="All mailboxes">
          <a
            href="/"
            className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
            aria-label="Back to mailboxes"
          >
            <ArrowLeft size={15} />
          </a>
        </Tooltip>
        <Wordmark size={26} />
        <span className="text-[var(--color-neutral-600)] text-sm">/</span>
        <span className="text-[13px] font-medium truncate">{folder}</span>

        <div className="flex-1" />

        <Tooltip content="Refresh">
          <button
            onClick={() => {
              folders.refetch();
              messages.refetch();
            }}
            className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </Tooltip>
        {pushCapable && (
          <Tooltip content={pushOn ? "Notifications on" : "Enable notifications"}>
            <button
              onClick={() => void togglePush()}
              className={`p-2 rounded-lg transition-colors ${
                pushOn
                  ? "text-[var(--color-accent)] hover:bg-[var(--hover-overlay)]"
                  : "text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]"
              }`}
              aria-label="Enable notifications"
              aria-pressed={pushOn}
            >
              <Bell size={14} />
            </button>
          </Tooltip>
        )}
        <ThemeToggle />
        <Tooltip content="Calendar">
          <button
            onClick={() => setCalendarOpen(true)}
            className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
            aria-label="Calendar"
          >
            <CalendarDays size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Contacts">
          <button
            onClick={() => setContactsOpen(true)}
            className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
            aria-label="Contacts"
          >
            <Users size={14} />
          </button>
        </Tooltip>
        <Tooltip content="Signatures & templates">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
            aria-label="Signatures and templates"
          >
            <Settings size={14} />
          </button>
        </Tooltip>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Edit3 size={13} />}
          onClick={() => setCompose({})}
        >
          Compose
        </Button>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Folder rail */}
        <nav
          className="w-[200px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-y-auto p-2"
          aria-label="Folders"
        >
          <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-neutral-700)]">
            Folders
          </div>
          {folders.data?.map((f) => {
            const active = folder === f.path;
            return (
              <button
                key={f.path}
                onClick={() => {
                  setFolder(f.path);
                  setOpenUid(null);
                }}
                className={
                  "w-full flex items-center gap-2.5 h-8 px-2 rounded-[7px] text-[13px] transition-colors " +
                  (active
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-neutral-1100)]"
                    : "text-[var(--color-neutral-1000)] hover:bg-[var(--hover-overlay)]")
                }
              >
                <span
                  className={
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-neutral-800)]"
                  }
                >
                  {f.path === "INBOX" ? (
                    <Inbox size={14} />
                  ) : (
                    <FolderIcon size={14} />
                  )}
                </span>
                <span className="flex-1 text-left truncate">{f.name}</span>
                {f.unread > 0 && (
                  <span className="text-[10px] font-medium tabular-nums px-1.5 py-px rounded-full bg-[var(--color-accent-strong)] text-[var(--color-accent)]">
                    {f.unread}
                  </span>
                )}
              </button>
            );
          })}
          <div className="mt-6 px-2 space-y-1.5 text-[11px] text-[var(--color-neutral-700)]">
            <div className="flex items-center gap-2">
              <KeyHint combo="c" /> compose
            </div>
            <div className="flex items-center gap-2">
              <KeyHint combo="s" /> star
            </div>
            <div className="flex items-center gap-2">
              <KeyHint combo="shift 3" /> delete
            </div>
          </div>
        </nav>

        {/* Message list */}
        <section
          className="shrink-0 min-h-0 flex flex-col"
          style={{ width: listW }}
          aria-label="Messages"
        >
          <div className="shrink-0 z-10 px-4 py-2 border-b border-[var(--color-border)] glass flex items-center gap-2">
            <Search size={13} className="text-[var(--color-neutral-700)] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search — try from: subject: has:attachment"
              aria-label="Search messages"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-[var(--color-neutral-700)]"
            />
            {searching && list.isFetching && <Spinner size={12} />}
            <span className="text-[11px] tabular-nums text-[var(--color-neutral-800)] shrink-0">
              {list.data ? `${listItems.length} of ${list.data.total}` : "…"}
            </span>
          </div>
          <div ref={listParentRef} className="flex-1 min-h-0 overflow-y-auto">
            {list.isLoading ? (
              <ul>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li
                    key={i}
                    className="px-4 py-3 border-b border-[var(--color-border)]"
                  >
                    <Skeleton className="h-3 w-28 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </li>
                ))}
              </ul>
            ) : list.data && listItems.length === 0 ? (
              <div className="p-6">
                <Empty
                  title={searching ? "No matches" : "This folder is empty"}
                  description={
                    searching ? `Nothing matches “${searchTerm}”.` : undefined
                  }
                  icon={searching ? <Search size={20} /> : <MailOpen size={20} />}
                />
              </div>
            ) : (
              <ul
                className="relative w-full"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const row = rows[vi.index]!;
                  const m =
                    row.kind === "head" ? row.thread.messages[0]! : row.m;
                  const count =
                    row.kind === "head" ? row.thread.messages.length : 1;
                  return (
                    <li
                      key={vi.key}
                      data-index={vi.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${vi.start}px)` }}
                    >
                      <MessageRow
                        m={m}
                        count={count}
                        child={row.kind === "child"}
                        expanded={
                          row.kind === "head" && expanded.has(row.thread.id)
                        }
                        selected={openUid === m.uid}
                        onOpen={() => openMessage(m)}
                        onToggle={
                          row.kind === "head" && count > 1
                            ? () => toggleThread(row.thread.id)
                            : undefined
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize message list"
          aria-valuenow={listW}
          aria-valuemin={280}
          aria-valuemax={560}
          onPointerDown={startResize}
          onKeyDown={resizeKey}
          className="w-[5px] shrink-0 cursor-col-resize border-l border-[var(--color-border)] hover:bg-[var(--color-accent-border)] focus-visible:bg-[var(--color-accent-hover)] focus-visible:outline-none transition-colors"
        />

        {/* Read pane */}
        <section className="flex-1 min-w-0 overflow-y-auto" aria-label="Message">
          {openUid === null ? (
            <div className="h-full grid place-items-center text-center p-8">
              <div>
                <span className="mx-auto mb-3 w-12 h-12 grid place-items-center rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-neutral-700)]">
                  <MailOpen size={20} />
                </span>
                <p className="text-sm text-[var(--color-neutral-900)]">
                  Select a message to read
                </p>
              </div>
            </div>
          ) : message.data ? (
            <article className="max-w-3xl mx-auto p-6">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                {message.data.subject || "(no subject)"}
              </h2>
              <div className="mt-4 flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
                <Avatar name={message.data.from} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {message.data.from}
                  </div>
                  <div className="text-xs text-[var(--color-neutral-800)] truncate">
                    to {message.data.to}
                    {message.data.date &&
                      ` · ${new Date(message.data.date).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip content="Star (s)">
                    <button
                      onClick={() => flag.mutate({ uid: openUid, action: "star" })}
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-warn)] transition-colors"
                      aria-label="Star"
                    >
                      <Star size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Reply">
                    <button
                      onClick={() => message.data && replyTo(message.data)}
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                      aria-label="Reply"
                    >
                      <Reply size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Forward">
                    <button
                      onClick={() => message.data && forwardMsg(message.data)}
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                      aria-label="Forward"
                    >
                      <Forward size={15} />
                    </button>
                  </Tooltip>
                  {archivePath && folder !== archivePath && (
                    <Tooltip content="Archive">
                      <button
                        onClick={() =>
                          move.mutate({ uid: openUid, destination: archivePath })
                        }
                        className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                        aria-label="Archive"
                      >
                        <Archive size={15} />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Delete (#)">
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--color-bad-surface)] hover:text-[var(--color-bad)] transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="py-5">
                {message.data.html ? (
                  <HtmlViewer html={message.data.html} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-neutral-1000)]">
                    {message.data.text}
                  </pre>
                )}
              </div>
              {message.data.attachments.length > 0 && (
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-neutral-800)] mb-2">
                    Attachments ({message.data.attachments.length})
                  </div>
                  <ul className="flex flex-wrap gap-3">
                    {message.data.attachments.map((a) => (
                      <AttachmentItem
                        key={a.id}
                        att={a}
                        url={`${API_BASE}/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${openUid}/attachments/${a.id}`}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ) : (
            <div className="h-full grid place-items-center">
              <Spinner size={20} />
            </div>
          )}
        </section>
      </div>

      {compose && (
        <ComposePanel
          orgId={orgId ?? ""}
          mailboxId={mailboxId}
          initial={compose}
          onClose={() => setCompose(null)}
        />
      )}

      {settingsOpen && orgId && (
        <PersonalizationModal
          orgId={orgId}
          mailboxId={mailboxId}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {contactsOpen && orgId && (
        <ContactsModal
          orgId={orgId}
          mailboxId={mailboxId}
          onClose={() => setContactsOpen(false)}
        />
      )}

      {calendarOpen && orgId && (
        <CalendarModal
          orgId={orgId}
          mailboxId={mailboxId}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete message?"
        description="This moves the message to Trash."
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (openUid !== null) remove.mutate(openUid);
          setConfirmDelete(false);
        }}
      />

      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open onClose={onCancel} size="sm" title={title} description={description}>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "c", label: "Compose new message" },
  { keys: "s", label: "Star / unstar open message" },
  { keys: "#", label: "Delete open message" },
  { keys: "?", label: "Toggle this shortcuts sheet" },
  { keys: "Esc", label: "Close dialogs and compose" },
];

function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Keyboard shortcuts"
      description="Work faster without leaving the keyboard."
    >
      <ul className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[var(--color-neutral-1000)]">
              {s.label}
            </span>
            <KeyHint combo={s.keys} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function HtmlViewer({ html }: { html: string }) {
  const [height, setHeight] = useState(480);
  // Rendered inside an isolated srcDoc iframe, so app theme vars cannot cascade
  // in — base readability styles are interpolated from the token constants.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{margin:16px;font:14px/1.6 ${fontFamily.sans};color:${neutralLight[10]};word-break:break-word}
img{max-width:100%;height:auto}
a{color:${brand[6]}}
table{max-width:100%}
pre{white-space:pre-wrap}
blockquote{border-left:3px solid ${neutralLight[3]};margin:8px 0;padding:2px 12px;color:${neutralLight[8]}}
</style></head><body>${html}</body></html>`;
  // No allow-scripts: message JS never runs. allow-same-origin lets the
  // parent measure the rendered height; popups escape the sandbox so links open.
  return (
    <iframe
      title="Message body"
      className="w-full bg-white rounded-lg border border-[var(--color-border)]"
      style={{ height }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={(e) => {
        const d = (e.target as HTMLIFrameElement).contentDocument;
        if (d?.body) {
          setHeight(Math.min(4000, Math.max(200, d.body.scrollHeight + 32)));
        }
      }}
    />
  );
}

function AttachmentItem({
  att,
  url,
}: {
  att: { id: string; filename: string; size: number; mime: string };
  url: string;
}) {
  const { toast } = useToast();
  const [thumb, setThumb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isImage = att.mime.startsWith("image/") && att.size < 5_000_000;

  useEffect(() => {
    if (!isImage) return;
    let obj: string | null = null;
    let cancelled = false;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("fetch failed"))))
      .then((b) => {
        if (cancelled) return;
        obj = URL.createObjectURL(b);
        setThumb(obj);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [url, isImage]);

  const download = async () => {
    setBusy(true);
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(`Download failed (${r.status})`);
      const obj = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = obj;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(obj);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="w-44 rounded-xl overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)]">
      {thumb ? (
        <button
          onClick={() => window.open(thumb, "_blank", "noopener")}
          className="block w-full h-24 cursor-zoom-in"
          aria-label={`Preview ${att.filename}`}
        >
          <img
            src={thumb}
            alt={att.filename}
            className="w-full h-full object-cover"
          />
        </button>
      ) : (
        <div className="h-24 grid place-items-center text-[var(--color-neutral-700)]">
          <FileText size={22} />
        </div>
      )}
      <div className="px-2.5 py-2 flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-1)]">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" title={att.filename}>
            {att.filename}
          </div>
          <div className="text-[10px] text-[var(--color-neutral-800)]">
            {fmtSize(att.size)}
          </div>
        </div>
        {busy ? (
          <Spinner size={14} />
        ) : (
          <IconButton size="sm" aria-label={`Download ${att.filename}`} onClick={download}>
            <Download size={13} />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function MessageRow({
  m,
  count,
  child,
  expanded,
  selected,
  onOpen,
  onToggle,
}: {
  m: MessageSummary;
  count: number;
  child: boolean;
  expanded: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle?: () => void;
}) {
  const unread = !m.flags.includes("\\Seen");
  const starred = m.flags.includes("\\Flagged");
  const sender =
    m.envelope.from?.[0]?.name ?? m.envelope.from?.[0]?.address ?? "?";
  return (
    <button
      onClick={onOpen}
      className={
        "relative w-full text-left py-3 border-b border-[var(--color-border)] transition-colors " +
        (child ? "pl-9 pr-4 bg-[var(--color-surface-1)] " : "px-4 ") +
        (selected
          ? "bg-[var(--color-accent-subtle)]"
          : "hover:bg-[var(--hover-overlay-faint)]")
      }
    >
      {(selected || child) && (
        <span
          className={
            "absolute left-0 top-0 bottom-0 w-[2px] " +
            (selected
              ? "bg-[var(--color-accent)]"
              : "bg-[var(--color-border-strong)]")
          }
        />
      )}
      <span className="flex items-center gap-2">
        {unread && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0" />
        )}
        <span
          className={
            "flex-1 truncate text-[13px] " +
            (unread
              ? "font-semibold text-[var(--color-neutral-1100)]"
              : "text-[var(--color-neutral-1000)]")
          }
        >
          {sender}
        </span>
        {onToggle && (
          <span
            role="button"
            tabIndex={0}
            aria-label={expanded ? "Collapse conversation" : "Expand conversation"}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggle();
              }
            }}
            className="flex items-center gap-0.5 shrink-0 rounded-full pl-1.5 pr-1 py-px text-[10px] font-medium tabular-nums bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-neutral-800)] hover:text-[var(--color-neutral-1100)] hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
          >
            {count}
            <ChevronRight
              size={11}
              className={
                "transition-transform " + (expanded ? "rotate-90" : "")
              }
            />
          </span>
        )}
        <span className="text-[11px] tabular-nums text-[var(--color-neutral-700)] shrink-0">
          {m.date &&
            new Date(m.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
        </span>
      </span>
      <span className="mt-0.5 flex items-center gap-1.5 text-xs">
        {starred && (
          <Star
            size={11}
            className="text-[var(--color-warn)] shrink-0"
            fill="currentColor"
            aria-label="Starred"
          />
        )}
        {m.has_attachments && (
          <Paperclip
            size={11}
            className="text-[var(--color-neutral-700)] shrink-0"
            aria-label="Has attachments"
          />
        )}
        <span
          className={
            "truncate " +
            (unread
              ? "text-[var(--color-neutral-1000)]"
              : "text-[var(--color-neutral-800)]")
          }
        >
          {m.envelope.subject || "(no subject)"}
        </span>
      </span>
      {m.preview && (
        <span className="mt-0.5 block truncate text-[11px] text-[var(--color-neutral-700)]">
          {m.preview}
        </span>
      )}
    </button>
  );
}

function UnlockScreen({
  orgId,
  mailboxId,
  onDone,
}: {
  orgId: string;
  mailboxId: string;
  onDone: () => void;
}) {
  const f = useForm<{ password: string }>({ defaultValues: { password: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (b: { password: string }) =>
      api.post(`/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/unlock`, b),
    onSuccess: onDone,
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });
  return (
    <div className="relative min-h-screen grid place-items-center p-4 bg-[var(--color-bg)]">
      <AuroraBackdrop />
      <Card className="relative p-6 max-w-sm w-full shadow-[var(--shadow-4)] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <h2 className="text-sm font-semibold mb-1">Unlock mailbox</h2>
        <p className="text-xs text-[var(--color-neutral-900)] mb-4">
          Enter the mailbox password to open your inbox. Credentials are sealed
          to your session.
        </p>
        <form
          onSubmit={f.handleSubmit((v) => {
            setErr(null);
            mut.mutate(v);
          })}
          className="space-y-3"
        >
          <FormField label="Password">
            <Input
              type="password"
              autoFocus
              {...f.register("password", { required: true })}
            />
          </FormField>
          {err && (
            <p className="text-xs text-[var(--color-bad)]" role="alert">
              {err}
            </p>
          )}
          <Button variant="primary" className="w-full" loading={mut.isPending}>
            Unlock
          </Button>
        </form>
      </Card>
    </div>
  );
}

// Chunk size for tus uploads. Kept under the API's 10 MB raw-body cap so a
// single chunk never trips the parser limit.
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

// Idle delay before a compose draft is autosaved to \Drafts.
const DRAFT_AUTOSAVE_MS = 2500;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Seed the contentEditable from plain text (reply/forward quotes) preserving
// line breaks. Rich content is authored in-place thereafter.
function textToHtml(text: string): string {
  if (!text) return "";
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

interface InsertItem {
  id: string;
  name: string;
  onSelect: () => void;
}

// Compact toolbar dropdown for inserting a signature or template.
function InsertMenu({
  icon,
  label,
  items,
  empty,
}: {
  icon: ReactNode;
  label: string;
  items: InsertItem[];
  empty: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Tooltip content={label}>
        <IconButton
          size="sm"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
        >
          {icon}
        </IconButton>
      </Tooltip>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] py-1 shadow-[var(--shadow-3)] animate-in fade-in-0 slide-in-from-top-1">
            {items.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[var(--color-neutral-700)]">
                {empty}
              </div>
            ) : (
              items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    it.onSelect();
                    setOpen(false);
                  }}
                  className="block w-full truncate px-3 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-3)]"
                >
                  {it.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Lightweight rich-text field over a contentEditable region. Formatting uses
// execCommand — deprecated but still universally implemented and the pragmatic
// choice for a small composer. Output HTML is sanitized server-side on send.
function RichTextEditor({
  editorRef,
  initialHtml,
  onInput,
  toolbarExtra,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  initialHtml: string;
  onInput: () => void;
  toolbarExtra?: ReactNode;
}) {
  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onInput();
  };
  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  };
  const btn = (
    aria: string,
    node: ReactNode,
    onClick: () => void,
  ) => (
    <IconButton
      size="sm"
      aria-label={aria}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {node}
    </IconButton>
  );
  return (
    <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] px-1.5 py-1">
        {btn("Bold", <Bold size={14} />, () => exec("bold"))}
        {btn("Italic", <Italic size={14} />, () => exec("italic"))}
        {btn("Underline", <Underline size={14} />, () => exec("underline"))}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {btn("Bulleted list", <List size={14} />, () =>
          exec("insertUnorderedList"),
        )}
        {btn("Numbered list", <ListOrdered size={14} />, () =>
          exec("insertOrderedList"),
        )}
        {btn("Insert link", <Link2 size={14} />, addLink)}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {toolbarExtra}
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className="min-h-[220px] max-h-[420px] overflow-y-auto px-3 py-2 text-[14px] leading-relaxed outline-none [&_a]:text-[var(--color-accent)] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}

function PersonalizationModal({
  orgId,
  mailboxId,
  onClose,
}: {
  orgId: string;
  mailboxId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("signatures");
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Mailbox settings"
      description="Signatures, templates, and filters, scoped to this mailbox."
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
        </TabsList>
        <TabsContent value="signatures">
          <SignatureManager orgId={orgId} mailboxId={mailboxId} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplateManager orgId={orgId} mailboxId={mailboxId} />
        </TabsContent>
        <TabsContent value="filters">
          <FilterManager orgId={orgId} mailboxId={mailboxId} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

function SignatureManager({
  orgId,
  mailboxId,
}: {
  orgId: string;
  mailboxId: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/signatures`;
  const key = ["signatures", orgId, mailboxId];
  const list = useQuery({ queryKey: key, queryFn: () => api.get<Signature[]>(base) });
  const [editing, setEditing] = useState<Signature | "new" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [isDefault, setIsDefault] = useState(false);

  const startEdit = (s: Signature | "new") => {
    setEditing(s);
    setIsDefault(s !== "new" && s.is_default);
  };

  const save = useMutation({
    mutationFn: (body: {
      name: string;
      html: string;
      text: string;
      is_default: boolean;
    }) =>
      editing === "new" || editing === null
        ? api.post<Signature>(base, body)
        : api.put<Signature>(`${base}/${editing.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setEditing(null);
      toast({ title: "Saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Save failed",
        tone: "bad",
      }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`${base}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Deleted", tone: "ok" });
    },
  });

  const submit = () => {
    const name = nameRef.current?.value.trim();
    if (!name) return toast({ title: "Name is required", tone: "bad" });
    save.mutate({
      name,
      html: editorRef.current?.innerHTML ?? "",
      text: editorRef.current?.innerText ?? "",
      is_default: isDefault,
    });
  };

  if (editing !== null) {
    const initialHtml =
      editing === "new" ? "" : editing.html || textToHtml(editing.text);
    return (
      <div className="space-y-3">
        <FormField label="Name">
          <Input
            ref={nameRef}
            defaultValue={editing === "new" ? "" : editing.name}
            placeholder="e.g. Work"
          />
        </FormField>
        <FormField label="Signature">
          <RichTextEditor
            editorRef={editorRef}
            initialHtml={initialHtml}
            onInput={() => {}}
          />
        </FormField>
        <label className="flex items-center gap-2 text-[13px] text-[var(--color-neutral-1000)]">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Use as default signature
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.data?.length === 0 && (
        <Empty title="No signatures" description="Create one to reuse in the composer." />
      )}
      {list.data?.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">
              {s.name}
              {s.is_default && (
                <span className="ml-2 rounded bg-[var(--color-surface-3)] px-1.5 py-0.5 text-[10px] text-[var(--color-neutral-800)]">
                  Default
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
            Edit
          </Button>
          <IconButton
            size="sm"
            aria-label="Delete signature"
            onClick={() => remove.mutate(s.id)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Plus size={13} />}
        onClick={() => startEdit("new")}
      >
        New signature
      </Button>
    </div>
  );
}

function TemplateManager({
  orgId,
  mailboxId,
}: {
  orgId: string;
  mailboxId: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/templates`;
  const key = ["templates", orgId, mailboxId];
  const list = useQuery({ queryKey: key, queryFn: () => api.get<Template[]>(base) });
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (body: {
      name: string;
      subject: string;
      html: string;
      text: string;
    }) =>
      editing === "new" || editing === null
        ? api.post<Template>(base, body)
        : api.put<Template>(`${base}/${editing.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setEditing(null);
      toast({ title: "Saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Save failed",
        tone: "bad",
      }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`${base}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Deleted", tone: "ok" });
    },
  });

  const submit = () => {
    const name = nameRef.current?.value.trim();
    if (!name) return toast({ title: "Name is required", tone: "bad" });
    save.mutate({
      name,
      subject: subjectRef.current?.value ?? "",
      html: editorRef.current?.innerHTML ?? "",
      text: editorRef.current?.innerText ?? "",
    });
  };

  if (editing !== null) {
    const initialHtml =
      editing === "new" ? "" : editing.html || textToHtml(editing.text);
    return (
      <div className="space-y-3">
        <FormField label="Name">
          <Input
            ref={nameRef}
            defaultValue={editing === "new" ? "" : editing.name}
            placeholder="e.g. Meeting follow-up"
          />
        </FormField>
        <FormField label="Subject">
          <Input
            ref={subjectRef}
            defaultValue={editing === "new" ? "" : editing.subject}
            placeholder="(optional)"
          />
        </FormField>
        <FormField label="Body">
          <RichTextEditor
            editorRef={editorRef}
            initialHtml={initialHtml}
            onInput={() => {}}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.data?.length === 0 && (
        <Empty title="No templates" description="Create one to reuse in the composer." />
      )}
      {list.data?.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{t.name}</div>
            {t.subject && (
              <div className="text-[11px] text-[var(--color-neutral-700)] truncate">
                {t.subject}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
            Edit
          </Button>
          <IconButton
            size="sm"
            aria-label="Delete template"
            onClick={() => remove.mutate(t.id)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Plus size={13} />}
        onClick={() => setEditing("new")}
      >
        New template
      </Button>
    </div>
  );
}

const FIELD_OPTIONS: { value: SieveConditionField; label: string }[] = [
  { value: "from", label: "From" },
  { value: "to", label: "To" },
  { value: "cc", label: "Cc" },
  { value: "subject", label: "Subject" },
  { value: "any", label: "Any header" },
];

const OP_OPTIONS: { value: SieveConditionOp; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "is", label: "is exactly" },
  { value: "matches", label: "matches (wildcards)" },
];

const ACTION_OPTIONS: { value: SieveActionType; label: string; arg?: string }[] = [
  { value: "fileinto", label: "Move to folder", arg: "Folder path" },
  { value: "flag", label: "Add flag", arg: "Flag (e.g. \\Flagged)" },
  { value: "seen", label: "Mark as read" },
  { value: "redirect", label: "Forward to", arg: "Address" },
  { value: "keep", label: "Keep in Inbox" },
  { value: "discard", label: "Discard silently" },
  { value: "stop", label: "Stop processing" },
];

const filterSelectClass =
  "h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 text-[13px] text-[var(--color-neutral-1000)] outline-none focus:border-[var(--color-accent)]";

function actionNeedsArg(type: SieveActionType): string | null {
  return ACTION_OPTIONS.find((o) => o.value === type)?.arg ?? null;
}

function FilterManager({
  orgId,
  mailboxId,
}: {
  orgId: string;
  mailboxId: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/filters`;
  const key = ["filters", orgId, mailboxId];
  const list = useQuery({ queryKey: key, queryFn: () => api.get<SieveRule[]>(base) });
  const [editing, setEditing] = useState<SieveRule | "new" | null>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [match, setMatch] = useState<SieveMatch>("all");
  const [conditions, setConditions] = useState<SieveCondition[]>([]);
  const [actions, setActions] = useState<SieveAction[]>([]);

  const startEdit = (r: SieveRule | "new") => {
    setEditing(r);
    setName(r === "new" ? "" : r.name);
    setEnabled(r === "new" ? true : r.enabled);
    setMatch(r === "new" ? "all" : r.match);
    setConditions(
      r === "new"
        ? [{ field: "from", op: "contains", value: "" }]
        : r.conditions,
    );
    setActions(r === "new" ? [{ type: "fileinto", arg: "" }] : r.actions);
  };

  const save = useMutation({
    mutationFn: (body: SieveRuleRequest) =>
      editing === "new" || editing === null
        ? api.post<SieveRule>(base, body)
        : api.put<SieveRule>(`${base}/${editing.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setEditing(null);
      toast({ title: "Filter saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Save failed",
        tone: "bad",
      }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`${base}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Deleted", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Delete failed",
        tone: "bad",
      }),
  });

  const submit = () => {
    if (!name.trim()) return toast({ title: "Name is required", tone: "bad" });
    if (actions.length === 0)
      return toast({ title: "Add at least one action", tone: "bad" });
    const cleaned = conditions.filter((c) => c.value.trim().length > 0);
    save.mutate({
      name: name.trim(),
      enabled,
      match,
      conditions: cleaned,
      actions: actions.map((a) => ({
        type: a.type,
        ...(actionNeedsArg(a.type) ? { arg: a.arg ?? "" } : {}),
      })),
    });
  };

  if (editing !== null) {
    return (
      <div className="space-y-3">
        <FormField label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Newsletters to Archive"
          />
        </FormField>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[var(--color-neutral-700)]">Match</span>
            <select
              className={filterSelectClass}
              value={match}
              onChange={(e) => setMatch(e.target.value as SieveMatch)}
            >
              <option value="all">all conditions</option>
              <option value="any">any condition</option>
            </select>
          </div>
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className={filterSelectClass}
                value={c.field}
                onChange={(e) =>
                  setConditions((cs) =>
                    cs.map((x, j) =>
                      j === i ? { ...x, field: e.target.value as SieveConditionField } : x,
                    ),
                  )
                }
              >
                {FIELD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className={filterSelectClass}
                value={c.op}
                onChange={(e) =>
                  setConditions((cs) =>
                    cs.map((x, j) =>
                      j === i ? { ...x, op: e.target.value as SieveConditionOp } : x,
                    ),
                  )
                }
              >
                {OP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                value={c.value}
                onChange={(e) =>
                  setConditions((cs) =>
                    cs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                  )
                }
                placeholder="value"
              />
              <IconButton
                size="sm"
                aria-label="Remove condition"
                onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </IconButton>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Plus size={13} />}
            onClick={() =>
              setConditions((cs) => [...cs, { field: "from", op: "contains", value: "" }])
            }
          >
            Add condition
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-[13px] text-[var(--color-neutral-700)]">Then</div>
          {actions.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className={filterSelectClass}
                value={a.type}
                onChange={(e) =>
                  setActions((as) =>
                    as.map((x, j) =>
                      j === i ? { type: e.target.value as SieveActionType, arg: "" } : x,
                    ),
                  )
                }
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {actionNeedsArg(a.type) && (
                <Input
                  value={a.arg ?? ""}
                  onChange={(e) =>
                    setActions((as) =>
                      as.map((x, j) => (j === i ? { ...x, arg: e.target.value } : x)),
                    )
                  }
                  placeholder={actionNeedsArg(a.type) ?? ""}
                />
              )}
              <IconButton
                size="sm"
                aria-label="Remove action"
                onClick={() => setActions((as) => as.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </IconButton>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Plus size={13} />}
            onClick={() => setActions((as) => [...as, { type: "fileinto", arg: "" }])}
          >
            Add action
          </Button>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[var(--color-neutral-1000)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.data?.length === 0 && (
        <Empty
          title="No filters"
          description="Create rules to automatically sort incoming mail."
        />
      )}
      {list.data?.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
        >
          <Filter size={14} className="text-[var(--color-neutral-700)]" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">
              {r.name}
              {!r.enabled && (
                <span className="ml-2 rounded bg-[var(--color-surface-3)] px-1.5 py-0.5 text-[10px] text-[var(--color-neutral-800)]">
                  Off
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--color-neutral-700)] truncate">
              {r.conditions.length} condition{r.conditions.length === 1 ? "" : "s"} ·{" "}
              {r.actions.length} action{r.actions.length === 1 ? "" : "s"}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>
            Edit
          </Button>
          <IconButton
            size="sm"
            aria-label="Delete filter"
            onClick={() => remove.mutate(r.id)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Plus size={13} />}
        onClick={() => startEdit("new")}
      >
        New filter
      </Button>
    </div>
  );
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Suggestion {
  name: string;
  address: string;
}

// Flatten a contact list into one suggestion per email address for recipient
// autocomplete.
function toSuggestions(contacts: Contact[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of contacts) {
    for (const e of c.emails) {
      out.push({ name: c.full_name, address: e.address });
    }
  }
  return out;
}

// Chip-style recipient input backed by a comma+space joined string so it stays
// compatible with the compose form's existing address splitting. Committed
// addresses render as chips; the trailing text is an editable draft that also
// contributes to the emitted value so a half-typed address is never dropped.
function RecipientField({
  value,
  onChange,
  suggestions,
  placeholder,
  autoFocus,
  ariaLabel,
  unstyled,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel: string;
  unstyled?: boolean;
}) {
  // Local source of truth, seeded once from the incoming value.
  const [emails, setEmails] = useState<string[]>(() => splitAddresses(value));
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const emit = (nextEmails: string[], nextDraft: string) => {
    onChange([...nextEmails, nextDraft].filter(Boolean).join(", "));
  };

  const addEmail = (addr: string) => {
    const clean = addr.trim();
    if (!clean) return;
    const next = emails.includes(clean) ? emails : [...emails, clean];
    setEmails(next);
    setDraft("");
    setOpen(false);
    setActive(0);
    emit(next, "");
  };

  const removeAt = (i: number) => {
    const next = emails.filter((_, j) => j !== i);
    setEmails(next);
    emit(next, draft);
  };

  const matches =
    draft.trim().length === 0
      ? []
      : suggestions
          .filter((s) => {
            const q = draft.toLowerCase();
            return (
              !emails.includes(s.address) &&
              (s.address.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q))
            );
          })
          .slice(0, 6);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && draft.trim()) {
      if (e.key !== "Tab") e.preventDefault();
      if (open && matches[active]) addEmail(matches[active]!.address);
      else addEmail(draft);
    } else if (e.key === "Backspace" && !draft && emails.length > 0) {
      removeAt(emails.length - 1);
    } else if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div
        className={
          unstyled
            ? "flex flex-wrap items-center gap-1.5"
            : "flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-2 py-1.5 focus-within:border-[var(--color-accent)] transition-colors"
        }
      >
        {emails.map((addr, i) => (
          <span
            key={`${addr}-${i}`}
            className="flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] pl-2 pr-1 py-0.5 text-xs font-medium"
          >
            <span className="max-w-52 truncate">{addr}</span>
            <IconButton
              size="sm"
              aria-label={`Remove ${addr}`}
              onClick={() => removeAt(i)}
            >
              <X size={11} />
            </IconButton>
          </span>
        ))}
        <input
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-[13px] font-mono py-0.5"
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          placeholder={emails.length === 0 ? placeholder : undefined}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setActive(0);
            emit(emails, e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) addEmail(draft);
            setOpen(false);
          }}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] shadow-[var(--shadow-4)]">
          {matches.map((s, i) => (
            <li key={s.address}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 flex flex-col ${
                  i === active
                    ? "bg-[var(--color-surface-2)]"
                    : "hover:bg-[var(--hover-overlay)]"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addEmail(s.address);
                }}
              >
                <span className="text-[13px] font-medium truncate">
                  {s.name}
                </span>
                <span className="text-xs text-[var(--color-neutral-800)] truncate font-mono">
                  {s.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactsModal({
  orgId,
  mailboxId,
  onClose,
}: {
  orgId: string;
  mailboxId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/contacts`;
  const key = ["contacts", orgId, mailboxId];
  const list = useQuery({ queryKey: key, queryFn: () => api.get<Contact[]>(base) });
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [query, setQuery] = useState("");

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`${base}/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Contact deleted", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Delete failed",
        tone: "bad",
      }),
  });

  const contacts = (list.data ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.emails.some((e) => e.address.toLowerCase().includes(q)) ||
      (c.organization ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Contacts"
      description="Your address book, synced over CardDAV."
    >
      {editing !== null ? (
        <ContactForm
          orgId={orgId}
          mailboxId={mailboxId}
          contact={editing === "new" ? null : editing}
          onDone={() => {
            qc.invalidateQueries({ queryKey: key });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search contacts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={13} />}
              onClick={() => setEditing("new")}
            >
              New
            </Button>
          </div>
          {list.isLoading ? (
            <div className="py-8 grid place-items-center">
              <Spinner size={18} />
            </div>
          ) : contacts.length === 0 ? (
            <Empty
              icon={<Users size={20} />}
              title={query ? "No matches" : "No contacts yet"}
              description={
                query
                  ? "Try a different search."
                  : "Add your first contact to start building your address book."
              }
            />
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto divide-y divide-[var(--color-border)]">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-2.5 group"
                >
                  <Avatar name={c.full_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {c.full_name}
                    </div>
                    <div className="text-xs text-[var(--color-neutral-800)] truncate font-mono">
                      {c.emails[0]?.address ??
                        c.organization ??
                        "No email"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      size="sm"
                      aria-label={`Edit ${c.full_name}`}
                      onClick={() => setEditing(c)}
                    >
                      <PenLine size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label={`Delete ${c.full_name}`}
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function ContactForm({
  orgId,
  mailboxId,
  contact,
  onDone,
  onCancel,
}: {
  orgId: string;
  mailboxId: string;
  contact: Contact | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/contacts`;
  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [emails, setEmails] = useState<string[]>(
    contact?.emails.map((e) => e.address) ?? [""],
  );
  const [phones, setPhones] = useState<string[]>(
    contact && contact.phones.length > 0
      ? contact.phones.map((p) => p.number)
      : [""],
  );
  const [organization, setOrganization] = useState(contact?.organization ?? "");
  const [note, setNote] = useState(contact?.note ?? "");

  const save = useMutation({
    mutationFn: (body: ContactRequest) =>
      contact
        ? api.put<Contact>(`${base}/${encodeURIComponent(contact.id)}`, body)
        : api.post<Contact>(base, body),
    onSuccess: () => {
      toast({ title: "Contact saved", tone: "ok" });
      onDone();
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Save failed",
        tone: "bad",
      }),
  });

  const submit = () => {
    if (!fullName.trim()) return toast({ title: "Name is required", tone: "bad" });
    save.mutate({
      full_name: fullName.trim(),
      emails: emails
        .map((a) => a.trim())
        .filter(Boolean)
        .map((address) => ({ address })),
      phones: phones
        .map((n) => n.trim())
        .filter(Boolean)
        .map((number) => ({ number })),
      organization: organization.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <FormField label="Name">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          autoFocus
        />
      </FormField>
      <MultiTextField
        label="Emails"
        values={emails}
        onChange={setEmails}
        placeholder="name@example.com"
        monospace
      />
      <MultiTextField
        label="Phones"
        values={phones}
        onChange={setPhones}
        placeholder="+1 555 123 4567"
      />
      <FormField label="Organization">
        <Input
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="(optional)"
        />
      </FormField>
      <FormField label="Note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="(optional)"
          className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] transition-colors resize-y"
        />
      </FormField>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// A list of single-line inputs with add/remove controls, used for the
// repeatable email and phone rows on a contact.
function MultiTextField({
  label,
  values,
  onChange,
  placeholder,
  monospace,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <FormField label={label}>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              monospace={monospace}
              value={v}
              placeholder={placeholder}
              onChange={(e) =>
                onChange(values.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
            <IconButton
              size="sm"
              aria-label={`Remove ${label} row`}
              onClick={() =>
                onChange(
                  values.length === 1
                    ? [""]
                    : values.filter((_, j) => j !== i),
                )
              }
            >
              <X size={14} />
            </IconButton>
          </div>
        ))}
        <Button
          variant="ghost"
          size="xs"
          leadingIcon={<Plus size={12} />}
          onClick={() => onChange([...values, ""])}
        >
          Add
        </Button>
      </div>
    </FormField>
  );
}

// ISO instant -> value for <input type="datetime-local"> in the viewer's local
// time. All-day events are stored at midnight UTC, so their date component is
// read back in UTC to avoid a timezone-induced off-by-one day.
function isoToLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}
function isoToUtcDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function localDateTimeToIso(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function dateToIso(v: string): string {
  return `${v}T00:00:00.000Z`;
}

function formatEventWhen(ev: CalendarEvent): string {
  const start = new Date(ev.starts_at);
  if (ev.all_day) {
    return start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CalendarModal({
  orgId,
  mailboxId,
  onClose,
}: {
  orgId: string;
  mailboxId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/calendar/events`;
  const key = ["calendar", orgId, mailboxId];
  const list = useQuery({
    queryKey: key,
    queryFn: () => api.get<CalendarEvent[]>(base),
  });
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`${base}/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Event deleted", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Delete failed",
        tone: "bad",
      }),
  });

  const events = list.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Calendar"
      description="Your events, synced over CalDAV."
    >
      {editing !== null ? (
        <EventForm
          orgId={orgId}
          mailboxId={mailboxId}
          event={editing === "new" ? null : editing}
          onDone={() => {
            qc.invalidateQueries({ queryKey: key });
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--color-neutral-800)]">
              {events.length} {events.length === 1 ? "event" : "events"}
            </span>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={13} />}
              onClick={() => setEditing("new")}
            >
              New event
            </Button>
          </div>
          {list.isLoading ? (
            <div className="py-8 grid place-items-center">
              <Spinner size={18} />
            </div>
          ) : events.length === 0 ? (
            <Empty
              icon={<CalendarDays size={20} />}
              title="No events yet"
              description="Create your first event to start planning."
            />
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto divide-y divide-[var(--color-border)]">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 py-2.5 group">
                  <div className="w-1 self-stretch rounded-full bg-[var(--color-accent)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {ev.summary || "(no title)"}
                    </div>
                    <div className="text-xs text-[var(--color-neutral-800)] truncate flex items-center gap-1.5">
                      <Clock size={11} />
                      {formatEventWhen(ev)}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      size="sm"
                      aria-label={`Edit ${ev.summary}`}
                      onClick={() => setEditing(ev)}
                    >
                      <PenLine size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label={`Delete ${ev.summary}`}
                      onClick={() => remove.mutate(ev.id)}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function EventForm({
  orgId,
  mailboxId,
  event,
  onDone,
  onCancel,
}: {
  orgId: string;
  mailboxId: string;
  event: CalendarEvent | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/calendar/events`;
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const [summary, setSummary] = useState(event?.summary ?? "");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startsAt, setStartsAt] = useState(event?.starts_at ?? defaultStart);
  const [endsAt, setEndsAt] = useState(event?.ends_at ?? defaultEnd);
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");

  const save = useMutation({
    mutationFn: (body: CalendarEventRequest) =>
      event
        ? api.put<CalendarEvent>(`${base}/${encodeURIComponent(event.id)}`, body)
        : api.post<CalendarEvent>(base, body),
    onSuccess: () => {
      toast({ title: "Event saved", tone: "ok" });
      onDone();
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Save failed",
        tone: "bad",
      }),
  });

  const submit = () => {
    if (!summary.trim()) return toast({ title: "Title is required", tone: "bad" });
    if (new Date(endsAt) < new Date(startsAt))
      return toast({ title: "End must be after start", tone: "bad" });
    save.mutate({
      summary: summary.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <FormField label="Title">
        <Input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Event title"
          autoFocus
        />
      </FormField>
      <label className="flex items-center gap-2 text-[13px] select-none cursor-pointer">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        All day
      </label>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Starts">
          <input
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? isoToUtcDate(startsAt) : isoToLocalDateTime(startsAt)}
            onChange={(e) =>
              setStartsAt(
                allDay ? dateToIso(e.target.value) : localDateTimeToIso(e.target.value),
              )
            }
            className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </FormField>
        <FormField label="Ends">
          <input
            type={allDay ? "date" : "datetime-local"}
            value={allDay ? isoToUtcDate(endsAt) : isoToLocalDateTime(endsAt)}
            onChange={(e) =>
              setEndsAt(
                allDay ? dateToIso(e.target.value) : localDateTimeToIso(e.target.value),
              )
            }
            className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </FormField>
      </div>
      <FormField label="Location">
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="(optional)"
        />
      </FormField>
      <FormField label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="(optional)"
          className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent)] transition-colors resize-y"
        />
      </FormField>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ComposePanel({
  orgId,
  mailboxId,
  initial,
  onClose,
}: {
  orgId: string;
  mailboxId: string;
  initial?: ComposeInit;
  onClose: () => void;
}) {
  const f = useForm<{
    to: string;
    cc: string;
    bcc: string;
    subject: string;
  }>({
    defaultValues: {
      to: initial?.to ?? "",
      cc: initial?.cc ?? "",
      bcc: "",
      subject: initial?.subject ?? "",
    },
  });
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initial?.cc));
  const { toast } = useToast();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep Tab cycling within the compose panel while it is focused. Compose is
  // non-modal (the mailbox stays clickable), so this only wraps at the edges
  // rather than blocking pointer interaction elsewhere.
  useEffect(() => {
    if (minimized) return;
    const el = panelRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [minimized]);
  // Bumped on every edit so autosave re-runs; the body itself is read from the
  // contentEditable DOM at save time rather than mirrored into React state.
  const [bodyRev, setBodyRev] = useState(0);
  const initialHtml = useMemo(() => textToHtml(initial?.text ?? ""), [initial]);
  const bodyText = () => editorRef.current?.innerText ?? "";
  const bodyHtml = () => editorRef.current?.innerHTML ?? "";

  const signatures = useQuery({
    queryKey: ["signatures", orgId, mailboxId],
    queryFn: () =>
      api.get<Signature[]>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/signatures`,
      ),
  });
  const templates = useQuery({
    queryKey: ["templates", orgId, mailboxId],
    queryFn: () =>
      api.get<Template[]>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/templates`,
      ),
  });
  const contacts = useQuery({
    queryKey: ["contacts", orgId, mailboxId],
    queryFn: () =>
      api.get<Contact[]>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/contacts`,
      ),
  });
  const recipientSuggestions = useMemo(
    () => toSuggestions(contacts.data ?? []),
    [contacts.data],
  );

  const insertHtml = (html: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand("insertHTML", false, html);
    setBodyRev((r) => r + 1);
  };
  // Live UID of this compose session's draft, carried across autosaves.
  const draftUidRef = useRef<number | undefined>(initial?.draftUid);
  const savingRef = useRef(false);

  const discardDraft = async () => {
    const uid = draftUidRef.current;
    if (uid === undefined) return;
    draftUidRef.current = undefined;
    try {
      await api.post(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/drafts/${uid}/discard`,
      );
      qc.invalidateQueries({ queryKey: ["messages", orgId, mailboxId] });
      qc.invalidateQueries({ queryKey: ["folders", orgId, mailboxId] });
    } catch {
      // Best-effort: a missing draft is already the desired state.
    }
  };

  const mut = useMutation({
    mutationFn: (b: ComposeRequest) =>
      api.post<SendResult>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/send`,
        b,
      ),
    onSuccess: async (res) => {
      await discardDraft();
      onClose();
      let cancelled = false;
      const cancel = () => {
        cancelled = true;
        return api
          .post(
            `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/scheduled/${res.id}/cancel`,
          )
          .then(() => toast({ title: "Send cancelled", tone: "ok" }))
          .catch((e) => {
            cancelled = false;
            toast({
              title:
                e instanceof ApiError
                  ? e.problem.detail ?? e.problem.title
                  : "Could not cancel",
              tone: "bad",
            });
          });
      };
      if (res.scheduled) {
        toast({
          title: "Scheduled",
          description: `Sends ${new Date(res.send_at).toLocaleString()}`,
          tone: "ok",
          action: { label: "Cancel", onClick: () => void cancel() },
        });
        return;
      }
      // Undo window: hold an "Undo" toast until the worker fires the send, then
      // poll the send row to report the real outcome — sent or failed — instead
      // of leaving the user guessing once the toast disappears.
      const windowMs = Math.max(0, new Date(res.send_at).getTime() - Date.now());
      toast({
        title: "Sending…",
        tone: "info",
        durationMs: windowMs,
        action: { label: "Undo", onClick: () => void cancel() },
      });
      window.setTimeout(() => {
        if (cancelled) return;
        void confirmSendOutcome(orgId, mailboxId, res.id, toast, () =>
          qc.invalidateQueries({ queryKey: ["folders", orgId, mailboxId] }),
        );
      }, windowMs + 400);
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const sx = e.clientX - offset.x;
    const sy = e.clientY - offset.y;
    const move = (ev: PointerEvent) =>
      setOffset({
        x: Math.min(0, ev.clientX - sx),
        y: Math.min(0, ev.clientY - sy),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const next = [...files, ...picked].slice(0, 16);
    if (next.reduce((s, x) => s + x.size, 0) > 15_000_000) {
      setErr("Attachments must stay under 15 MB total.");
      return;
    }
    setErr(null);
    setFiles(next);
  };

  // Upload a file to storage via the tus-style endpoints and return its
  // finalised attachment id. Chunked to stay under the raw-body limit.
  const uploadFile = async (file: File): Promise<string> => {
    const upload = await api.post<Upload>(`/v1/orgs/${orgId}/uploads`, {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      size_bytes: file.size,
    });
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + UPLOAD_CHUNK_BYTES, file.size);
      const res = await fetch(
        `${API_BASE}/v1/orgs/${orgId}/uploads/${upload.id}/chunks`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/offset+octet-stream",
            "upload-offset": String(offset),
          },
          body: file.slice(offset, end),
        },
      );
      if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
      offset = end;
    }
    const att = await api.post<Attachment>(
      `/v1/orgs/${orgId}/uploads/${upload.id}/finalise`,
    );
    return att.id;
  };

  const subject = f.watch("subject");
  const toVal = f.watch("to");
  const ccVal = f.watch("cc");

  // Drop a default signature into a fresh compose once signatures load.
  const signatureSeeded = useRef(false);
  useEffect(() => {
    if (signatureSeeded.current) return;
    const def = signatures.data?.find((s) => s.is_default);
    if (!def || !editorRef.current) return;
    signatureSeeded.current = true;
    if (def.html) insertHtml(`<br><br>${def.html}`);
  }, [signatures.data]);

  // Autosave to \Drafts after a pause in typing, replacing the prior version so
  // the folder keeps a single live draft per compose session.
  useEffect(() => {
    const hasContent =
      [toVal, ccVal, subject].some((v) => (v ?? "").trim()) ||
      bodyText().trim().length > 0;
    if (!hasContent) return;
    const timer = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const res = await api.post<SavedDraft>(
          `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/drafts`,
          {
            to: splitAddresses(toVal),
            cc: splitAddresses(ccVal),
            subject,
            text: bodyText(),
            html: bodyHtml() || undefined,
            in_reply_to: initial?.in_reply_to,
            references: initial?.references,
            replace_uid: draftUidRef.current,
          },
        );
        if (res.uid != null) {
          draftUidRef.current = res.uid;
          setSavedAt(Date.now());
        }
      } catch {
        // Autosave is best-effort; the user can still send or retry.
      } finally {
        savingRef.current = false;
      }
    }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [toVal, ccVal, subject, bodyRev, orgId, mailboxId, initial]);

  const submit = (sendAt?: string) =>
    f.handleSubmit(async (v) => {
      setErr(null);
      const to = v.to
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const cc = v.cc
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const bcc = v.bcc
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (to.length === 0) return setErr("At least one recipient required.");
      let attachmentIds: string[] | undefined;
      if (files.length > 0) {
        setUploading(true);
        try {
          attachmentIds = await Promise.all(files.map(uploadFile));
        } catch (e) {
          setUploading(false);
          return setErr(
            e instanceof ApiError
              ? e.problem.detail ?? e.problem.title
              : (e as Error).message,
          );
        }
        setUploading(false);
      }
      const html = bodyHtml();
      mut.mutate({
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: v.subject,
        text: bodyText(),
        html: html.trim() ? html : undefined,
        attachment_ids: attachmentIds,
        in_reply_to: initial?.in_reply_to,
        references: initial?.references,
        send_at: sendAt,
      });
    })();

  const send = () => void submit();
  const scheduleSend = () => {
    if (!scheduleAt) return;
    const at = new Date(scheduleAt);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      setErr("Pick a send time in the future.");
      return;
    }
    setScheduleOpen(false);
    void submit(at.toISOString());
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[var(--z-overlay)] flex items-center gap-2 rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] shadow-[var(--shadow-3)] pl-3 pr-4 py-2 text-[13px] font-medium hover:shadow-[var(--shadow-4)] transition-shadow animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        aria-label="Restore compose window"
      >
        <Edit3 size={13} className="text-[var(--color-accent)]" />
        <span className="max-w-56 truncate">{subject || "New message"}</span>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Compose message"
      className="fixed bottom-4 right-4 z-[var(--z-overlay)] w-[560px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] shadow-[var(--shadow-5)] animate-in fade-in-0 slide-in-from-bottom-3 duration-200"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <header
        onPointerDown={startDrag}
        className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <Edit3 size={13} className="text-[var(--color-accent)] ml-1" />
        <span className="flex-1 text-[13px] font-medium truncate">
          {subject || "New message"}
        </span>
        <IconButton
          size="sm"
          aria-label="Minimize compose"
          onClick={() => setMinimized(true)}
        >
          <Minus size={14} />
        </IconButton>
        <IconButton size="sm" aria-label="Close compose" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>
      <form className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {/* Recipient + subject rows: borderless with inline labels and hairline
            dividers, Superhuman/Gmail-style, rather than boxed form fields. */}
        <div className="px-4">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5">
            <span className="w-9 shrink-0 text-[12px] text-[var(--color-neutral-800)]">
              To
            </span>
            <div className="flex-1 min-w-0">
              <Controller
                control={f.control}
                name="to"
                rules={{ required: true }}
                render={({ field }) => (
                  <RecipientField
                    ariaLabel="To"
                    value={field.value}
                    onChange={field.onChange}
                    suggestions={recipientSuggestions}
                    placeholder="alice@example.com"
                    autoFocus
                    unstyled
                  />
                )}
              />
            </div>
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="shrink-0 text-[12px] text-[var(--color-neutral-800)] hover:text-[var(--color-neutral-1100)] transition-colors"
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5">
                <span className="w-9 shrink-0 text-[12px] text-[var(--color-neutral-800)]">
                  Cc
                </span>
                <div className="flex-1 min-w-0">
                  <Controller
                    control={f.control}
                    name="cc"
                    render={({ field }) => (
                      <RecipientField
                        ariaLabel="Cc"
                        value={field.value}
                        onChange={field.onChange}
                        suggestions={recipientSuggestions}
                        placeholder="(optional)"
                        unstyled
                      />
                    )}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5">
                <span className="w-9 shrink-0 text-[12px] text-[var(--color-neutral-800)]">
                  Bcc
                </span>
                <div className="flex-1 min-w-0">
                  <Controller
                    control={f.control}
                    name="bcc"
                    render={({ field }) => (
                      <RecipientField
                        ariaLabel="Bcc"
                        value={field.value}
                        onChange={field.onChange}
                        suggestions={recipientSuggestions}
                        placeholder="(optional)"
                        unstyled
                      />
                    )}
                  />
                </div>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5">
            <input
              {...f.register("subject")}
              placeholder="Subject"
              aria-label="Subject"
              className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-[var(--color-neutral-1100)] placeholder:font-normal placeholder:text-[var(--color-neutral-700)] focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 px-4 pt-3 pb-2">
          <RichTextEditor
            editorRef={editorRef}
            initialHtml={initialHtml}
            onInput={() => setBodyRev((r) => r + 1)}
            toolbarExtra={
              <>
                <InsertMenu
                  icon={<PenLine size={14} />}
                  label="Signature"
                  items={(signatures.data ?? []).map((s) => ({
                    id: s.id,
                    name: s.name,
                    onSelect: () => insertHtml(s.html || escapeHtml(s.text)),
                  }))}
                  empty="No signatures yet"
                />
                <InsertMenu
                  icon={<FileText size={14} />}
                  label="Template"
                  items={(templates.data ?? []).map((t) => ({
                    id: t.id,
                    name: t.name,
                    onSelect: () => {
                      if (t.subject) f.setValue("subject", t.subject);
                      insertHtml(t.html || escapeHtml(t.text));
                    },
                  }))}
                  empty="No templates yet"
                />
              </>
            }
          />
        </div>
        {(files.length > 0 || err) && (
          <div className="px-4 pb-3 space-y-2">
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
                  >
                    <Paperclip
                      size={11}
                      className="text-[var(--color-neutral-800)] shrink-0"
                    />
                    <span className="max-w-40 truncate font-medium">
                      {file.name}
                    </span>
                    <span className="text-[var(--color-neutral-800)]">
                      {fmtSize(file.size)}
                    </span>
                    <IconButton
                      size="sm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setFiles((p) => p.filter((_, j) => j !== i))
                      }
                    >
                      <X size={12} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            {err && (
              <p className="text-xs text-[var(--color-bad)]" role="alert">
                {err}
              </p>
            )}
          </div>
        )}
      </form>
      <footer className="shrink-0 px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={onPick}
            aria-label="Attach files"
          />
          <Tooltip content="Attach files (15 MB max)">
            <IconButton
              size="sm"
              aria-label="Attach files"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={14} />
            </IconButton>
          </Tooltip>
          <span className="text-[11px] text-[var(--color-neutral-700)]">
            {savedAt ? "Draft saved" : "Plain text"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              void discardDraft();
              onClose();
            }}
          >
            Discard
          </Button>
          <div className="relative">
            <Tooltip content="Schedule send">
              <IconButton
                size="sm"
                aria-label="Schedule send"
                onClick={() => setScheduleOpen((o) => !o)}
              >
                <Clock size={14} />
              </IconButton>
            </Tooltip>
            {scheduleOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] p-3 shadow-[var(--shadow-3)] animate-in fade-in-0 slide-in-from-bottom-1">
                <label className="block text-[11px] font-medium text-[var(--color-neutral-900)] mb-1">
                  Send later
                </label>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-2 py-1 text-[13px]"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!scheduleAt}
                    onClick={scheduleSend}
                  >
                    Schedule
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="primary"
            loading={mut.isPending || uploading}
            onClick={send}
          >
            {uploading ? "Uploading…" : "Send"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
