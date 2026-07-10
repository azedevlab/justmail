"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useForm } from "react-hook-form";
import type { Folder, MessageSummary, Message, ComposeRequest } from "@justmail/contracts";
import { ApiError, useHotkey } from "@justmail/shared-utils";
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
  Skeleton,
  Spinner,
  Textarea,
  Tooltip,
  useToast,
  Wordmark,
} from "@justmail/shared-ui";
import {
  Archive,
  ArrowLeft,
  Clock,
  Edit3,
  Folder as FolderIcon,
  Inbox,
  MailOpen,
  Minus,
  RefreshCw,
  Reply,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMe } from "@/lib/session";
import { api } from "@/lib/api";

export default function MailboxView() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [folder, setFolder] = useState("INBOX");
  const [openUid, setOpenUid] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState("");
  const [listW, setListW] = useState(360);

  useEffect(() => {
    const saved = Number(localStorage.getItem("jm.listWidth"));
    if (saved >= 280 && saved <= 560) setListW(saved);
  }, []);

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
      api.get<{ messages: MessageSummary[]; total: number }>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages?limit=100`,
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

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["messages", orgId, mailboxId, folder] });

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

  useHotkey("c", () => setShowCompose(true));
  useHotkey("#", () => openUid && remove.mutate(openUid), { deps: [openUid] });
  useHotkey("s", () =>
    openUid && flag.mutate({ uid: openUid, action: "star" }),
    { deps: [openUid] },
  );

  const q = search.trim().toLowerCase();
  const filtered = (messages.data?.messages ?? []).filter((m) => {
    if (!q) return true;
    const sender =
      m.envelope.from?.[0]?.name ?? m.envelope.from?.[0]?.address ?? "";
    return (
      sender.toLowerCase().includes(q) ||
      (m.envelope.subject ?? "").toLowerCase().includes(q)
    );
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
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Edit3 size={13} />}
          onClick={() => setShowCompose(true)}
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
                    ? "bg-[color:rgb(124_92_255/0.14)] text-[var(--color-neutral-1100)]"
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
                  <span className="text-[10px] font-medium tabular-nums px-1.5 py-px rounded-full bg-[color:rgb(124_92_255/0.16)] text-[var(--color-accent)]">
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
          className="shrink-0 overflow-y-auto"
          style={{ width: listW }}
          aria-label="Messages"
        >
          <div className="sticky top-0 z-10 px-4 py-2 border-b border-[var(--color-border)] glass flex items-center gap-2">
            <Search size={13} className="text-[var(--color-neutral-700)] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sender or subject…"
              aria-label="Search messages"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-[var(--color-neutral-700)]"
            />
            <span className="text-[11px] tabular-nums text-[var(--color-neutral-800)] shrink-0">
              {messages.data
                ? `${filtered.length} of ${messages.data.total}`
                : "…"}
            </span>
          </div>
          <ul>
            {messages.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="px-4 py-3 border-b border-[var(--color-border)]">
                  <Skeleton className="h-3 w-28 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </li>
              ))}
            {messages.data && filtered.length === 0 && (
              <li className="p-6">
                <Empty
                  title={q ? "No matches" : "This folder is empty"}
                  description={
                    q ? `Nothing matches “${search.trim()}”.` : undefined
                  }
                  icon={q ? <Search size={20} /> : <MailOpen size={20} />}
                />
              </li>
            )}
            {filtered.map((m) => {
              const unread = !m.flags.includes("\\Seen");
              const starred = m.flags.includes("\\Flagged");
              const sender =
                m.envelope.from?.[0]?.name ??
                m.envelope.from?.[0]?.address ??
                "?";
              const selected = openUid === m.uid;
              return (
                <li key={m.uid}>
                  <button
                    onClick={() => {
                      setOpenUid(m.uid);
                      if (unread) flag.mutate({ uid: m.uid, action: "read" });
                    }}
                    className={
                      "relative w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-colors " +
                      (selected
                        ? "bg-[color:rgb(124_92_255/0.1)]"
                        : "hover:bg-[var(--hover-overlay-faint)]")
                    }
                  >
                    {selected && (
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-brand-500)]" />
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
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize message list"
          onPointerDown={startResize}
          className="w-[5px] shrink-0 cursor-col-resize border-l border-[var(--color-border)] hover:bg-[color:rgb(124_92_255/0.25)] transition-colors"
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
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                      aria-label="Reply"
                    >
                      <Reply size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Archive">
                    <button
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                      aria-label="Archive"
                    >
                      <Archive size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Snooze">
                    <button
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)] transition-colors"
                      aria-label="Snooze"
                    >
                      <Clock size={15} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete (#)">
                    <button
                      onClick={() => {
                        if (confirm("Delete this message?")) remove.mutate(openUid);
                      }}
                      className="p-2 rounded-lg text-[var(--color-neutral-900)] hover:bg-[color:rgb(239_68_68/0.12)] hover:text-[var(--color-bad)] transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="py-5">
                {message.data.html ? (
                  <iframe
                    className="w-full min-h-[480px] bg-white rounded-lg border border-[var(--color-border)]"
                    srcDoc={message.data.html}
                    sandbox=""
                    title="Message body"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-neutral-1000)]">
                    {message.data.text}
                  </pre>
                )}
              </div>
              {message.data.attachments.length > 0 && (
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-neutral-800)] mb-2">
                    Attachments
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {message.data.attachments.map((a, i) => (
                      <li
                        key={i}
                        className="px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs"
                      >
                        <span className="font-medium">{a.filename}</span>
                        <span className="text-[var(--color-neutral-800)]">
                          {" "}
                          · {(a.size / 1024).toFixed(1)} KB
                        </span>
                      </li>
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

      {showCompose && (
        <ComposePanel
          orgId={orgId ?? ""}
          mailboxId={mailboxId}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
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

function ComposePanel({
  orgId,
  mailboxId,
  onClose,
}: {
  orgId: string;
  mailboxId: string;
  onClose: () => void;
}) {
  const f = useForm<{
    to: string;
    cc: string;
    subject: string;
    text: string;
  }>({
    defaultValues: { to: "", cc: "", subject: "", text: "" },
  });
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const mut = useMutation({
    mutationFn: (b: ComposeRequest) =>
      api.post(`/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/send`, b),
    onSuccess: () => {
      onClose();
      toast({ title: "Sent", tone: "ok" });
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

  const subject = f.watch("subject");
  const send = f.handleSubmit((v) => {
    setErr(null);
    const to = v.to
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const cc = v.cc
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (to.length === 0) return setErr("At least one recipient required.");
    mut.mutate({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: v.subject,
      text: v.text,
    });
  });

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
      <form className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <FormField label="To">
          <Input
            monospace
            autoFocus
            placeholder="alice@example.com"
            {...f.register("to", { required: true })}
          />
        </FormField>
        <FormField label="Cc">
          <Input monospace placeholder="(optional)" {...f.register("cc")} />
        </FormField>
        <FormField label="Subject">
          <Input {...f.register("subject")} />
        </FormField>
        <FormField label="Message">
          <Textarea rows={10} {...f.register("text")} />
        </FormField>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
      <footer className="shrink-0 px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-neutral-700)]">
          Plain text
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <Button variant="primary" loading={mut.isPending} onClick={send}>
            Send
          </Button>
        </div>
      </footer>
    </div>
  );
}
