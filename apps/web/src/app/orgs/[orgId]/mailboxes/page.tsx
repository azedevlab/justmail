"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateMailboxRequest,
  Domain,
  Mailbox,
} from "@justmail/types";
import { api, ApiError, API_BASE } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader, StatusBadge } from "../../../../components/shell";
import { Modal } from "../domains/page";

export default function MailboxesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["mailboxes", orgId],
    queryFn: () => api.get<Mailbox[]>(`/v1/orgs/${orgId}/mailboxes`),
  });
  const domains = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });

  return (
    <>
      <PageHeader
        title="Mailboxes"
        description="Users, quotas, forwarding, and per-mailbox controls."
        actions={
          <>
            <a
              href={`${API_BASE}/v1/orgs/${orgId}/mailboxes.csv`}
              className="btn btn-secondary"
            >
              Export CSV
            </a>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Add mailbox
            </button>
          </>
        }
      />
      <PageBody>
        {list.isLoading && (
          <div className="text-sm text-[var(--color-ink-300)]">Loading…</div>
        )}
        {list.data && list.data.length === 0 ? (
          <EmptyState
            title="No mailboxes yet."
            action={
              domains.data && domains.data.length === 0 ? (
                <a
                  href={`/orgs/${orgId}/domains`}
                  className="text-[var(--color-brand-400)] text-sm hover:underline"
                >
                  Add a domain first →
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  Add your first mailbox
                </button>
              )
            }
          />
        ) : (
          list.data && (
            <div className="card overflow-hidden">
              <table className="data">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Name</th>
                    <th>Quota</th>
                    <th>Status</th>
                    <th>Protocols</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((m) => (
                    <MailboxRow key={m.id} orgId={orgId} mailbox={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {showCreate && domains.data && (
          <CreateModal
            orgId={orgId}
            domains={domains.data}
            onClose={() => setShowCreate(false)}
          />
        )}
      </PageBody>
    </>
  );
}

function MailboxRow({ orgId, mailbox }: { orgId: string; mailbox: Mailbox }) {
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const del = useMutation({
    mutationFn: () => api.del(`/v1/orgs/${orgId}/mailboxes/${mailbox.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailboxes", orgId] }),
  });
  const toggle = useMutation({
    mutationFn: (status: "active" | "suspended") =>
      api.patch(`/v1/orgs/${orgId}/mailboxes/${mailbox.id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailboxes", orgId] }),
  });
  const pct =
    mailbox.quota_mb > 0
      ? Math.min(100, (mailbox.quota_used_bytes / 1024 / 1024 / mailbox.quota_mb) * 100)
      : 0;
  return (
    <>
      <tr>
        <td className="mono">{mailbox.address}</td>
        <td className="text-[var(--color-ink-200)]">{mailbox.name || "—"}</td>
        <td>
          <div className="text-xs mono">
            {(mailbox.quota_used_bytes / 1024 / 1024).toFixed(0)}/{mailbox.quota_mb} MB
          </div>
          <div className="h-1 mt-1 rounded bg-white/5 overflow-hidden w-32">
            <div
              className="h-full bg-[var(--color-brand-500)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </td>
        <td>
          <StatusBadge status={mailbox.status} />
        </td>
        <td className="text-xs text-[var(--color-ink-300)]">
          {[
            mailbox.imap_enabled && "IMAP",
            mailbox.pop3_enabled && "POP3",
            mailbox.smtp_enabled && "SMTP",
          ]
            .filter(Boolean)
            .join(" · ")}
        </td>
        <td className="text-right space-x-2">
          <button
            className="text-xs text-[var(--color-brand-400)] hover:underline"
            onClick={() => setShowPw(true)}
          >
            Password
          </button>
          <button
            className="text-xs text-[var(--color-ink-300)] hover:underline"
            onClick={() =>
              toggle.mutate(mailbox.status === "active" ? "suspended" : "active")
            }
          >
            {mailbox.status === "active" ? "Suspend" : "Resume"}
          </button>
          <button
            className="text-xs text-[var(--color-bad-500)] hover:underline"
            onClick={() => {
              if (confirm(`Delete ${mailbox.address}? Cannot be undone.`)) del.mutate();
            }}
          >
            Delete
          </button>
        </td>
      </tr>
      {showPw && (
        <SetPasswordModal
          orgId={orgId}
          mailbox={mailbox}
          onClose={() => setShowPw(false)}
        />
      )}
    </>
  );
}

function CreateModal({
  orgId,
  domains,
  onClose,
}: {
  orgId: string;
  domains: Domain[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const f = useForm<CreateMailboxRequest & { domain_id: string }>({
    defaultValues: {
      domain_id: domains[0]?.id,
      local_part: "",
      name: "",
      password: "",
      quota_mb: 1024,
    },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateMailboxRequest & { domain_id: string }) => {
      const { domain_id, ...rest } = body;
      return api.post<Mailbox>(
        `/v1/orgs/${orgId}/domains/${domain_id}/mailboxes`,
        rest,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mailboxes", orgId] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title="Add mailbox">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          mut.mutate({ ...v, local_part: v.local_part.toLowerCase() });
        })}
      >
        <label className="block">
          <span className="label">Address</span>
          <div className="flex">
            <input
              className="input mono rounded-r-none"
              placeholder="local-part"
              autoFocus
              {...f.register("local_part", { required: true })}
            />
            <span className="px-3 grid place-items-center bg-white/5 border border-l-0 border-white/10 rounded-r-md text-sm text-[var(--color-ink-300)]">
              @
            </span>
            <select
              className="select rounded-l-none"
              {...f.register("domain_id", { required: true })}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className="label">Display name</span>
          <input className="input" {...f.register("name")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Password (min 10)</span>
            <input
              className="input"
              type="password"
              {...f.register("password", { required: true, minLength: 10 })}
            />
          </label>
          <label className="block">
            <span className="label">Quota (MB)</span>
            <input
              className="input mono"
              type="number"
              min={0}
              {...f.register("quota_mb", { valueAsNumber: true, min: 0 })}
            />
          </label>
        </div>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Creating…" : "Create mailbox"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasswordModal({
  orgId,
  mailbox,
  onClose,
}: {
  orgId: string;
  mailbox: Mailbox;
  onClose: () => void;
}) {
  const f = useForm<{ password: string }>({ defaultValues: { password: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: { password: string }) =>
      api.put(`/v1/orgs/${orgId}/mailboxes/${mailbox.id}/password`, body),
    onSuccess: onClose,
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title={`Set password: ${mailbox.address}`}>
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          mut.mutate(v);
        })}
      >
        <label className="block">
          <span className="label">New password (min 10)</span>
          <input
            className="input"
            type="password"
            autoFocus
            {...f.register("password", { required: true, minLength: 10 })}
          />
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Setting…" : "Set password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
