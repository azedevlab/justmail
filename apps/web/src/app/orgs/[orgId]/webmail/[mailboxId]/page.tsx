"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiError } from "../../../../../lib/api";
import { PageBody, PageHeader } from "../../../../../components/shell";
import { Modal } from "../../domains/page";

interface Folder {
  path: string;
  name: string;
  specialUse: string | null;
}
interface Envelope {
  from?: Array<{ address: string; name?: string }>;
  to?: Array<{ address: string; name?: string }>;
  subject?: string;
  date?: string;
}
interface Message {
  uid: number;
  seq: number;
  flags: string[];
  envelope: Envelope;
  size: number;
  date: string | null;
}
interface FullMessage {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  text: string;
  html: string | null;
  attachments: Array<{ filename: string; size: number; mime: string }>;
}

export default function WebmailMailbox() {
  const { orgId, mailboxId } = useParams<{ orgId: string; mailboxId: string }>();
  const qc = useQueryClient();
  const [folder, setFolder] = useState("INBOX");
  const [openUid, setOpenUid] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const folders = useQuery({
    queryKey: ["webmail-folders", orgId, mailboxId],
    queryFn: () =>
      api.get<Folder[]>(`/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders`),
    retry: false,
  });

  const messages = useQuery({
    queryKey: ["webmail-messages", orgId, mailboxId, folder],
    enabled: !!folders.data,
    queryFn: () =>
      api.get<{ messages: Message[]; total: number }>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages?limit=100`,
      ),
  });

  const message = useQuery({
    queryKey: ["webmail-message", orgId, mailboxId, folder, openUid],
    enabled: openUid !== null,
    queryFn: () =>
      api.get<FullMessage>(
        `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${openUid}`,
      ),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["webmail-messages", orgId, mailboxId, folder] });

  const setFlag = useMutation({
    mutationFn: (v: { uid: number; action: "read" | "unread" | "star" | "unstar" }) =>
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
    },
  });

  if (folders.isError && (folders.error as ApiError).status === 403) {
    return <UnlockScreen orgId={orgId} mailboxId={mailboxId} onDone={() => folders.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="Webmail"
        description={folders.data ? `${folders.data.length} folders` : "Loading…"}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => folders.refetch()}>
              Refresh
            </button>
            <button className="btn btn-primary" onClick={() => setShowCompose(true)}>
              + Compose
            </button>
          </>
        }
      />
      <PageBody>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "180px 380px 1fr", minHeight: "70vh" }}
        >
          <aside className="card overflow-hidden">
            <div className="p-2 text-xs uppercase tracking-wide text-[var(--color-ink-400)]">
              Folders
            </div>
            <nav className="text-sm">
              {folders.data?.map((f) => (
                <button
                  key={f.path}
                  onClick={() => {
                    setFolder(f.path);
                    setOpenUid(null);
                  }}
                  className={
                    "w-full text-left px-3 py-2 hover:bg-white/5 " +
                    (folder === f.path ? "text-[var(--color-brand-400)]" : "")
                  }
                >
                  {f.name}
                </button>
              ))}
            </nav>
          </aside>
          <section className="card overflow-hidden">
            <div className="p-3 border-b border-white/5 text-xs text-[var(--color-ink-400)]">
              {folder} · {messages.data?.messages.length ?? 0} of {messages.data?.total ?? 0}
            </div>
            <ul className="divide-y divide-white/5 overflow-auto max-h-[65vh]">
              {messages.data?.messages.map((m) => {
                const unread = !m.flags.includes("\\Seen");
                const starred = m.flags.includes("\\Flagged");
                const sender = m.envelope?.from?.[0]?.name ?? m.envelope?.from?.[0]?.address ?? "?";
                return (
                  <li
                    key={m.uid}
                    className={
                      "px-3 py-2 cursor-pointer hover:bg-white/5 " +
                      (openUid === m.uid ? "bg-white/5" : "")
                    }
                    onClick={() => {
                      setOpenUid(m.uid);
                      if (unread) setFlag.mutate({ uid: m.uid, action: "read" });
                    }}
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
                      <span className={"flex-1 truncate " + (unread ? "font-semibold" : "")}>
                        {sender}
                      </span>
                      <span className="text-xs text-[var(--color-ink-400)]">
                        {m.date ? new Date(m.date).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-ink-300)] truncate mt-0.5">
                      {starred && "★ "}
                      {m.envelope?.subject || "(no subject)"}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card overflow-hidden p-5">
            {openUid === null ? (
              <div className="text-sm text-[var(--color-ink-300)]">
                Select a message
              </div>
            ) : message.data ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {message.data.subject || "(no subject)"}
                    </h2>
                    <div className="text-xs mono text-[var(--color-ink-300)] mt-1">
                      {message.data.from}
                    </div>
                    <div className="text-xs text-[var(--color-ink-400)] mt-0.5">
                      to {message.data.to}
                      {message.data.date &&
                        ` · ${new Date(message.data.date).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setFlag.mutate({ uid: openUid, action: "star" })
                      }
                    >
                      ★
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (confirm("Delete this message?")) remove.mutate(openUid);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <hr className="border-white/5 my-4" />
                {message.data.html ? (
                  <iframe
                    className="w-full min-h-[400px] bg-white rounded-lg"
                    srcDoc={message.data.html}
                    sandbox=""
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-ink-200)]">
                    {message.data.text}
                  </pre>
                )}
                {message.data.attachments.length > 0 && (
                  <>
                    <hr className="border-white/5 my-4" />
                    <div className="text-sm font-medium mb-2">Attachments</div>
                    <ul className="text-xs text-[var(--color-ink-300)] space-y-1">
                      {message.data.attachments.map((a, i) => (
                        <li key={i}>
                          {a.filename} — {a.mime} · {(a.size / 1024).toFixed(1)} KB
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-[var(--color-ink-300)] animate-pulse">
                Loading…
              </div>
            )}
          </section>
        </div>
        {showCompose && (
          <ComposeModal
            orgId={orgId}
            mailboxId={mailboxId}
            onClose={() => setShowCompose(false)}
          />
        )}
      </PageBody>
    </>
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
    mutationFn: (body: { password: string }) =>
      api.post(`/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/unlock`, body),
    onSuccess: onDone,
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <>
      <PageHeader title="Webmail" description="Unlock this mailbox to continue." />
      <PageBody>
        <div className="card p-6 max-w-sm">
          <form
            className="space-y-3"
            onSubmit={f.handleSubmit((v) => {
              setErr(null);
              mut.mutate(v);
            })}
          >
            <label className="block">
              <span className="label">Mailbox password</span>
              <input
                className="input"
                type="password"
                autoFocus
                {...f.register("password", { required: true })}
              />
            </label>
            {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
            <button className="btn btn-primary w-full" disabled={mut.isPending}>
              {mut.isPending ? "Unlocking…" : "Unlock mailbox"}
            </button>
          </form>
        </div>
      </PageBody>
    </>
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
  const f = useForm<{ to: string; subject: string; text: string }>({
    defaultValues: { to: "", subject: "", text: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: { to: string[]; subject: string; text: string }) =>
      api.post(`/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}/send`, body),
    onSuccess: onClose,
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title="Compose message">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          const to = v.to
            .split(/[,\s;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (to.length === 0) return setErr("Add at least one recipient");
          mut.mutate({ to, subject: v.subject, text: v.text });
        })}
      >
        <label className="block">
          <span className="label">To</span>
          <input
            className="input mono"
            placeholder="recipient@example.com"
            autoFocus
            {...f.register("to", { required: true })}
          />
        </label>
        <label className="block">
          <span className="label">Subject</span>
          <input className="input" {...f.register("subject")} />
        </label>
        <label className="block">
          <span className="label">Message</span>
          <textarea
            className="input"
            rows={10}
            style={{ resize: "vertical" }}
            {...f.register("text")}
          />
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
