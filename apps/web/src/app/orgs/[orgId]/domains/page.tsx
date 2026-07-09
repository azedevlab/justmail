"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { CreateDomainRequest, Domain } from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader, StatusBadge } from "../../../../components/shell";

export default function DomainsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });

  return (
    <>
      <PageHeader
        title="Domains"
        description="Domains you host mail for, with verification and DNS state."
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add domain
          </button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows />}
        {list.data && list.data.length === 0 && !showCreate && (
          <EmptyState
            title="No domains yet."
            action={
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                Add your first domain
              </button>
            }
          />
        )}
        {list.data && list.data.length > 0 && (
          <div className="card overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Mailboxes</th>
                  <th>Outbound</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">
                      {d.name}
                      {d.is_primary && (
                        <span className="badge badge-muted ml-2">primary</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>{d.mailbox_count}</td>
                    <td>
                      <span className="badge badge-muted">{d.outbound_mode}</span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/orgs/${orgId}/domains/${d.id}`}
                        className="text-[var(--color-brand-400)] hover:underline text-xs"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showCreate && <CreateModal orgId={orgId} onClose={() => setShowCreate(false)} />}
      </PageBody>
    </>
  );
}

function CreateModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useForm<CreateDomainRequest>({ defaultValues: { name: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateDomainRequest) =>
      api.post<Domain>(`/v1/orgs/${orgId}/domains`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title="Add domain">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          mut.mutate({ name: v.name.trim().toLowerCase(), is_primary: v.is_primary });
        })}
      >
        <label className="block">
          <span className="label">Domain</span>
          <input
            className="input mono"
            placeholder="example.com"
            autoFocus
            {...f.register("name", { required: true })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...f.register("is_primary")} />
          Make this the primary domain for outbound
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Adding…" : "Add domain"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold mb-4">{title}</div>
        {children}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="card p-5 space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-6 rounded bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}
