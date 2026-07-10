"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Folder, MessageSummary, Message, ComposeRequest } from "@justmail/contracts";
import { ApiError, useHotkey } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageBody,
  PageHeader,
  Skeleton,
  Spinner,
  Textarea,
  useToast,
} from "@justmail/shared-ui";
import {
  Archive,
  Clock,
  Edit3,
  Inbox,
  Reply,
  Star,
  Trash2,
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
    <div className="min-h-screen">
      <PageHeader
        title="Inbox"
        description={folders.data ? `${folders.data.length} folders` : "Loading…"}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => folders.refetch()}
              leadingIcon={<Inbox size={14} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Edit3 size={14} />}
              onClick={() => setShowCompose(true)}
            >
              Compose
            </Button>
          </>
        }
      />
      <PageBody>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "180px 380px 1fr",
            minHeight: "calc(100vh - 200px)",
          }}
        >
          {/* Folder tree */}
          <Card className="overflow-hidden">
            <div className="p-2 text-[11px] uppercase tracking-wider text-[var(--color-neutral-900)]">
              Folders
            </div>
            <nav className="text-sm">
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
                      "w-full text-left px-3 py-2 hover:bg-white/5 flex justify-between items-center " +
                      (active ? "text-[var(--color-brand-400)]" : "")
                    }
                  >
                    <span>{f.name}</span>
                    {f.unread > 0 && (
                      <span className="text-[10px] font-mono text-[var(--color-neutral-900)]">
                        {f.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </Card>

          {/* Message list */}
          <Card className="overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--color-border)] text-xs text-[var(--color-neutral-900)]">
              {folder} · {messages.data?.messages.length ?? 0} shown ({messages.data?.total ?? 0} total)
            </div>
            <ul className="divide-y divide-[var(--color-border)] overflow-y-auto max-h-[65vh]">
              {messages.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="p-3">
                    <Skeleton className="h-3 w-24 mb-1" />
                    <Skeleton className="h-3 w-full" />
                  </li>
                ))}
              {messages.data?.messages.length === 0 && (
                <li>
                  <Empty title="This folder is empty" />
                </li>
              )}
              {messages.data?.messages.map((m) => {
                const unread = !m.flags.includes("\\Seen");
                const starred = m.flags.includes("\\Flagged");
                const sender =
                  m.envelope.from?.[0]?.name ??
                  m.envelope.from?.[0]?.address ??
                  "?";
                return (
                  <li
                    key={m.uid}
                    onClick={() => {
                      setOpenUid(m.uid);
                      if (unread) flag.mutate({ uid: m.uid, action: "read" });
                    }}
                    className={
                      "px-3 py-2 cursor-pointer hover:bg-white/5 " +
                      (openUid === m.uid ? "bg-white/[0.04]" : "")
                    }
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          "w-1 h-4 rounded-full " +
                          (unread
                            ? "bg-[var(--color-brand-500)]"
                            : "bg-transparent")
                        }
                      />
                      <span
                        className={
                          "flex-1 truncate " + (unread ? "font-semibold" : "")
                        }
                      >
                        {sender}
                      </span>
                      <span className="text-xs text-[var(--color-neutral-900)]">
                        {m.date && new Date(m.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-neutral-900)] truncate mt-0.5 flex items-center gap-1">
                      {starred && (
                        <Star
                          size={10}
                          className="text-[var(--color-warn)]"
                          aria-label="Starred"
                        />
                      )}
                      <span>{m.envelope.subject || "(no subject)"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Read pane */}
          <Card className="overflow-hidden p-5">
            {openUid === null ? (
              <div className="text-sm text-[var(--color-neutral-900)]">
                Select a message
              </div>
            ) : message.data ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {message.data.subject || "(no subject)"}
                    </h2>
                    <div className="text-xs mono text-[var(--color-neutral-900)] mt-1">
                      {message.data.from}
                    </div>
                    <div className="text-xs text-[var(--color-neutral-700)] mt-0.5">
                      to {message.data.to}
                      {message.data.date &&
                        ` · ${new Date(message.data.date).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        flag.mutate({ uid: openUid, action: "star" })
                      }
                      leadingIcon={<Star size={12} />}
                    >
                      Star
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Reply size={12} />}
                    >
                      Reply
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Archive size={12} />}
                    >
                      Archive
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Clock size={12} />}
                    >
                      Snooze
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leadingIcon={<Trash2 size={12} />}
                      onClick={() => {
                        if (confirm("Delete this message?")) remove.mutate(openUid);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <hr className="border-[var(--color-border)] my-4" />
                {message.data.html ? (
                  <iframe
                    className="w-full min-h-[400px] bg-white rounded-lg"
                    srcDoc={message.data.html}
                    sandbox=""
                    title="Message body"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-neutral-1000)]">
                    {message.data.text}
                  </pre>
                )}
                {message.data.attachments.length > 0 && (
                  <>
                    <hr className="border-[var(--color-border)] my-4" />
                    <div className="text-sm font-medium mb-2">Attachments</div>
                    <ul className="text-xs text-[var(--color-neutral-900)] space-y-1">
                      {message.data.attachments.map((a, i) => (
                        <li key={i}>
                          {a.filename} — {a.mime} · {(a.size / 1024).toFixed(1)}{" "}
                          KB
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <Spinner size={20} />
            )}
          </Card>
        </div>
      </PageBody>
      {showCompose && (
        <ComposeModal
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
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="p-6 max-w-sm w-full">
        <h2 className="text-sm font-semibold mb-1">Unlock mailbox</h2>
        <p className="text-xs text-[var(--color-neutral-900)] mb-4">
          Enter the mailbox password to open your inbox.
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

function ComposeModal({
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
  return (
    <Modal
      open
      onClose={onClose}
      title="Compose"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mut.isPending}
            onClick={f.handleSubmit((v) => {
              setErr(null);
              const to = v.to
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              const cc = v.cc
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              if (to.length === 0)
                return setErr("At least one recipient required.");
              mut.mutate({
                to,
                cc: cc.length > 0 ? cc : undefined,
                subject: v.subject,
                text: v.text,
              });
            })}
          >
            Send
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="To">
          <Input
            monospace
            autoFocus
            placeholder="alice@example.com"
            {...f.register("to", { required: true })}
          />
        </FormField>
        <FormField label="Cc">
          <Input
            monospace
            placeholder="(optional)"
            {...f.register("cc")}
          />
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
    </Modal>
  );
}
