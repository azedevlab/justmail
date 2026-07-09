"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { BlockedIp, CreateBlockedIpRequest } from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { PageBody, PageHeader, StatusBadge } from "../../../../components/shell";
import { Modal } from "../domains/page";

export default function SecurityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const [showBlock, setShowBlock] = useState(false);
  const score = useQuery({
    queryKey: ["score", orgId],
    queryFn: () =>
      api.get<{ score: number; factors: Array<{ id: string; label: string; ok: boolean; weight: number }> }>(
        `/v1/orgs/${orgId}/security/score`,
      ),
  });
  const blocked = useQuery({
    queryKey: ["blocked", orgId],
    queryFn: () => api.get<BlockedIp[]>(`/v1/orgs/${orgId}/security/blocked-ips`),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/security/blocked-ips/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Security"
        description="Deliverability score, blocked IPs, and mail-plane hardening."
        actions={
          <button className="btn btn-primary" onClick={() => setShowBlock(true)}>
            + Block IP
          </button>
        }
      />
      <PageBody>
        {score.data && (
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Deliverability score</div>
                <div className="text-xs text-[var(--color-ink-300)] mt-1">
                  Verified domains + published records
                </div>
              </div>
              <div className="text-3xl font-semibold mono">
                {score.data.score}
                <span className="text-[var(--color-ink-400)] text-lg">/100</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {score.data.factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 p-3 text-sm"
                >
                  <span>{f.label}</span>
                  <StatusBadge status={f.ok ? "ok" : "pending"} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 text-sm font-medium">
            Blocked IPs
          </div>
          {blocked.data && blocked.data.length === 0 ? (
            <div className="p-6 text-sm text-[var(--color-ink-300)]">
              Nothing blocked. Fail2Ban will list bruteforcers here automatically.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Source</th>
                  <th>Reason</th>
                  <th>Expires</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {blocked.data?.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.ip}</td>
                    <td>
                      <span className="badge badge-muted">{b.source}</span>
                    </td>
                    <td className="text-sm text-[var(--color-ink-200)]">
                      {b.reason || "—"}
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {b.expires_at
                        ? new Date(b.expires_at).toLocaleString()
                        : "never"}
                    </td>
                    <td className="text-right">
                      <button
                        className="text-xs text-[var(--color-brand-400)] hover:underline"
                        onClick={() => unblock.mutate(b.id)}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showBlock && (
          <BlockModal orgId={orgId} onClose={() => setShowBlock(false)} />
        )}
      </PageBody>
    </>
  );
}

function BlockModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useForm<CreateBlockedIpRequest>({ defaultValues: { ip: "", reason: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateBlockedIpRequest) =>
      api.post(`/v1/orgs/${orgId}/security/blocked-ips`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked", orgId] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title="Block IP">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          mut.mutate(v);
        })}
      >
        <label className="block">
          <span className="label">IP or CIDR</span>
          <input
            className="input mono"
            placeholder="203.0.113.42 or 203.0.113.0/24"
            autoFocus
            {...f.register("ip", { required: true })}
          />
        </label>
        <label className="block">
          <span className="label">Reason (optional)</span>
          <input className="input" {...f.register("reason")} />
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" disabled={mut.isPending}>
            {mut.isPending ? "Blocking…" : "Block"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
