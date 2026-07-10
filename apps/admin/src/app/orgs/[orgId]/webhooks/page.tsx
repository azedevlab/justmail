"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type {
  CreatedWebhook,
  CreateWebhookRequest,
  WebhookEndpoint,
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
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

const EVENTS = [
  "mailbox.created",
  "mailbox.updated",
  "mailbox.deleted",
  "domain.verified",
  "dkim.rotated",
  "mail.received",
  "mail.sent",
  "mail.deferred",
  "mail.bounced",
  "security.ip.blocked",
];

export default function WebhooksPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["webhooks", orgId],
    queryFn: () => api.get<WebhookEndpoint[]>(`/v1/orgs/${orgId}/webhooks`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/webhooks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks", orgId] });
      toast({ title: "Webhook removed", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="HTTP POSTs signed with HMAC-SHA256. Retries: 6× exponential (10 s → 6 h)."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowCreate(true)}
          >
            Add endpoint
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={3} />}
        {list.data && list.data.length === 0 && (
          <Empty title="No webhook endpoints" />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>URL</TH>
                  <TH>Events</TH>
                  <TH>Last status</TH>
                  <TH>Failures</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((w) => (
                  <TR key={w.id}>
                    <TD>
                      <span className="mono text-xs">{w.url}</span>
                    </TD>
                    <TD className="text-xs">{w.events.join(", ")}</TD>
                    <TD>
                      {w.last_status ? (
                        <StatusBadge
                          status={
                            w.last_status >= 200 && w.last_status < 300
                              ? "ok"
                              : "error"
                          }
                        />
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </TD>
                    <TD>
                      <span className="mono text-xs">{w.failure_count}</span>
                    </TD>
                    <TD className="text-right">
                      <button
                        className="text-xs text-[var(--color-bad)] hover:underline"
                        onClick={() => {
                          if (confirm("Delete this endpoint?")) remove.mutate(w.id);
                        }}
                      >
                        Delete
                      </button>
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
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });
  if (secret) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Signing secret"
        description="Store this — it's the HMAC key for the x-justmail-signature header."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(secret);
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
          {secret}
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Register webhook"
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
              if (v.events.length === 0)
                return setErr("Subscribe to at least one event.");
              mut.mutate(v);
            })}
          >
            Register
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="URL">
          <Input
            monospace
            autoFocus
            placeholder="https://…"
            {...f.register("url", { required: true })}
          />
        </FormField>
        <div>
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-900)]">
            Events
          </span>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {EVENTS.map((ev) => (
              <label
                key={ev}
                className="flex items-center gap-2 rounded p-1.5 hover:bg-[var(--hover-overlay)] text-sm cursor-pointer"
              >
                <input type="checkbox" value={ev} {...f.register("events")} />
                <span className="mono text-xs">{ev}</span>
              </label>
            ))}
          </div>
        </div>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
