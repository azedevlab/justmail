"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Alias, CreateAliasRequest, Domain } from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader } from "../../../../components/shell";
import { Modal } from "../domains/page";

export default function AliasesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["aliases", orgId],
    queryFn: () => api.get<Alias[]>(`/v1/orgs/${orgId}/aliases`),
  });
  const domains = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/aliases/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aliases", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Aliases"
        description="Forwarding-only addresses that route to one or more destinations."
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add alias
          </button>
        }
      />
      <PageBody>
        {list.data && list.data.length === 0 && (
          <EmptyState title="No aliases yet." />
        )}
        {list.data && list.data.length > 0 && (
          <div className="card overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Destinations</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.address}</td>
                    <td className="mono text-xs">{a.destinations.join(", ")}</td>
                    <td className="text-right">
                      <button
                        className="text-xs text-[var(--color-bad-500)] hover:underline"
                        onClick={() => {
                          if (confirm(`Delete alias ${a.address}?`)) del.mutate(a.id);
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
  const f = useForm<CreateAliasRequest & { domain_id: string; destinations_str: string }>({
    defaultValues: {
      domain_id: domains[0]?.id,
      source: "",
      destinations_str: "",
      destinations: [],
    },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: async (body: CreateAliasRequest & { domain_id: string }) => {
      const { domain_id, ...rest } = body;
      return api.post<Alias>(`/v1/orgs/${orgId}/domains/${domain_id}/aliases`, rest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases", orgId] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  return (
    <Modal onClose={onClose} title="Add alias">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          const dests = v.destinations_str
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (dests.length === 0) return setErr("Add at least one destination");
          mut.mutate({
            source: v.source.toLowerCase(),
            destinations: dests,
            domain_id: v.domain_id,
          });
        })}
      >
        <label className="block">
          <span className="label">Source</span>
          <div className="flex">
            <input
              className="input mono rounded-r-none"
              placeholder="local-part"
              autoFocus
              {...f.register("source", { required: true })}
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
          <span className="label">Destinations (comma-separated)</span>
          <input
            className="input mono"
            placeholder="alice@example.com, bob@example.com"
            {...f.register("destinations_str", { required: true })}
          />
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Creating…" : "Create alias"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
