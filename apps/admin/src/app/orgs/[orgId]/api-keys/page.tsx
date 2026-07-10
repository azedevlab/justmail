"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreatedApiKey,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageBody,
  PageHeader,
  SkeletonRows,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

export default function ApiKeysPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => api.get<ApiKey[]>(`/v1/orgs/${orgId}/api-keys`),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/api-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
      toast({ title: "Key revoked", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="API keys"
        description="Bearer tokens for programmatic access. Send as Authorization: Bearer jm_…"
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowCreate(true)}
          >
            Issue key
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={3} />}
        {list.data && list.data.length === 0 && (
          <Empty title="No API keys yet" />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Prefix</TH>
                  <TH>Scopes</TH>
                  <TH>Last used</TH>
                  <TH>Created</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((k) => (
                  <TR key={k.id} className={k.revoked_at ? "opacity-50" : ""}>
                    <TD>{k.name}</TD>
                    <TD>
                      <span className="mono text-xs">{k.key_prefix}…</span>
                    </TD>
                    <TD className="text-xs">
                      {k.scopes.length === 0 ? "all" : k.scopes.join(", ")}
                    </TD>
                    <TD className="text-xs">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString()
                        : "—"}
                    </TD>
                    <TD className="text-xs">
                      {new Date(k.created_at).toLocaleDateString()}
                    </TD>
                    <TD className="text-right">
                      {!k.revoked_at && (
                        <button
                          className="text-xs text-[var(--color-bad)] hover:underline"
                          onClick={() => {
                            if (confirm(`Revoke ${k.name}?`)) revoke.mutate(k.id);
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </PageBody>
      {showCreate && (
        <CreateModal orgId={orgId} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}

function CreateModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
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
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });
  if (token) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Copy your key now"
        description="This is the only time we'll show the full token."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(token);
                toast({ title: "Copied", tone: "ok" });
              }}
            >
              Copy
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="mono text-xs break-all p-3 rounded-md bg-[var(--color-neutral-100)] border border-[var(--color-border)]">
          {token}
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue API key"
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
              const scopes = v.scopes_str
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              mut.mutate({ name: v.name, scopes });
            })}
          >
            Issue
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Name">
          <Input
            placeholder="Terraform, backup script, …"
            autoFocus
            {...f.register("name", { required: true })}
          />
        </FormField>
        <FormField
          label="Scopes"
          hint="Comma or space separated; empty = full access"
        >
          <Input
            monospace
            placeholder="mailboxes:read domains:read"
            {...f.register("scopes_str")}
          />
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
