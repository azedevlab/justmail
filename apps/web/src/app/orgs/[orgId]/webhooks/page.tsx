"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreatedWebhook,
  CreateWebhookRequest,
  WebhookEndpoint,
} from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader, StatusBadge } from "../../../../components/shell";
import { Modal } from "../domains/page";

const EVENTS = [
  "mailbox.created",
  "mailbox.suspended",
  "mailbox.deleted",
  "domain.verified",
  "dkim.rotated",
  "mail.deferred",
  "mail.rejected",
  "security.ip.blocked",
];

export default function WebhooksPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["webhooks", orgId],
    queryFn: () => api.get<WebhookEndpoint[]>(`/v1/orgs/${orgId}/webhooks`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="HTTP POSTs signed with HMAC-SHA256; the platform retries with exponential backoff for up to 6 attempts."
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add endpoint
          </button>
        }
      />
      <PageBody>
        {list.data && list.data.length === 0 && (
          <EmptyState title="No webhook endpoints." />
        )}
        {list.data && list.data.length > 0 && (
          <div className="card overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Last status</th>
                  <th>Failures</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((w) => (
                  <tr key={w.id}>
                    <td className="mono text-xs max-w-md truncate" title={w.url}>
                      {w.url}
                    </td>
                    <td className="text-xs">{w.events.join(", ")}</td>
                    <td>
                      {w.last_status ? (
                        <StatusBadge
                          status={
                            w.last_status >= 200 && w.last_status < 300
                              ? "ok"
                              : "error"
                          }
                        />
                      ) : (
                        <span className="text-xs text-[var(--color-ink-400)]">—</span>
                      )}
                    </td>
                    <td className="mono text-xs">{w.failure_count}</td>
                    <td className="text-right">
                      <button
                        className="text-xs text-[var(--color-bad-500)] hover:underline"
                        onClick={() => {
                          if (confirm("Delete this endpoint?")) remove.mutate(w.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showCreate && (
          <CreateModal orgId={orgId} onClose={() => setShowCreate(false)} />
        )}
      </PageBody>
    </>
  );
}

function CreateModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useForm<{ url: string; events: string[] }>({
    defaultValues: { url: "", events: [] },
  });
  const [err, setErr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateWebhookRequest) =>
      api.post<CreatedWebhook>(`/v1/orgs/${orgId}/webhooks`, body),
    onSuccess: (r) => {
      setSecret(r.secret);
      qc.invalidateQueries({ queryKey: ["webhooks", orgId] });
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message,
      ),
  });
  if (secret) {
    return (
      <Modal onClose={onClose} title="Signing secret">
        <p className="text-xs text-[var(--color-warn-500)] mb-3">
          Store this — it&apos;s the HMAC key for the x-justmail-signature header.
        </p>
        <div className="card p-3 mono text-xs break-all">{secret}</div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard.writeText(secret)}
          >
            Copy
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose} title="Register webhook">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          if (v.events.length === 0)
            return setErr("Select at least one event to subscribe to.");
          mut.mutate(v);
        })}
      >
        <label className="block">
          <span className="label">URL</span>
          <input
            className="input mono"
            placeholder="https://…"
            autoFocus
            {...f.register("url", { required: true })}
          />
        </label>
        <div>
          <span className="label">Events</span>
          <div className="grid grid-cols-2 gap-1 text-sm mt-1">
            {EVENTS.map((ev) => (
              <label
                key={ev}
                className="flex items-center gap-2 rounded-md p-1.5 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  value={ev}
                  {...f.register("events")}
                />
                <span className="mono text-xs">{ev}</span>
              </label>
            ))}
          </div>
        </div>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Register"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
