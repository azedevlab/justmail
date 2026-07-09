"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { ApiKey, CreateApiKeyRequest, CreatedApiKey } from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { EmptyState, PageBody, PageHeader } from "../../../../components/shell";
import { Modal } from "../domains/page";

export default function ApiKeysPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => api.get<ApiKey[]>(`/v1/orgs/${orgId}/api-keys`),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/api-keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="API keys"
        description="Bearer tokens for programmatic access. Send as Authorization: Bearer jm_… — same routes as the web UI."
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Issue key
          </button>
        }
      />
      <PageBody>
        {list.data && list.data.length === 0 && (
          <EmptyState title="No API keys yet." />
        )}
        {list.data && list.data.length > 0 && (
          <div className="card overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Scopes</th>
                  <th>Last used</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((k) => (
                  <tr key={k.id} className={k.revoked_at ? "opacity-50" : ""}>
                    <td>{k.name}</td>
                    <td className="mono text-xs">{k.key_prefix}…</td>
                    <td className="text-xs">
                      {k.scopes.length === 0 ? (
                        <span className="text-[var(--color-ink-400)]">all</span>
                      ) : (
                        k.scopes.join(", ")
                      )}
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      {!k.revoked_at && (
                        <button
                          className="text-xs text-[var(--color-bad-500)] hover:underline"
                          onClick={() => {
                            if (confirm(`Revoke ${k.name}?`)) revoke.mutate(k.id);
                          }}
                        >
                          Revoke
                        </button>
                      )}
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
  const f = useForm<CreateApiKeyRequest & { scopes_str: string }>({
    defaultValues: { name: "", scopes: [], scopes_str: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateApiKeyRequest) =>
      api.post<CreatedApiKey>(`/v1/orgs/${orgId}/api-keys`, body),
    onSuccess: (r) => {
      setToken(r.token);
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });
  if (token) {
    return (
      <Modal onClose={onClose} title="Copy your key now">
        <p className="text-xs text-[var(--color-warn-500)] mb-3">
          This is the only time we&apos;ll show the full token.
        </p>
        <div className="card p-3 mono text-xs break-all bg-[var(--color-ink-800)]">
          {token}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard.writeText(token)}
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
    <Modal onClose={onClose} title="Issue API key">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          const scopes = v.scopes_str
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          mut.mutate({ name: v.name, scopes });
        })}
      >
        <label className="block">
          <span className="label">Name</span>
          <input
            className="input"
            placeholder="Terraform, backup script, …"
            autoFocus
            {...f.register("name", { required: true })}
          />
        </label>
        <label className="block">
          <span className="label">Scopes (comma-separated, optional)</span>
          <input
            className="input mono"
            placeholder="mailboxes:read,domains:read"
            {...f.register("scopes_str")}
          />
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Issuing…" : "Issue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
