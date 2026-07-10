"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type {
  LegalHold,
  Mailbox,
  MailboxExport,
  RetentionPolicy,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
  FormField,
  Input,
  PageBody,
  PageHeader,
  SkeletonRows,
  Table,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from "@justmail/shared-ui";
import { Download, Lock, ShieldAlert } from "lucide-react";
import { api, API_BASE } from "@/lib/api";

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.problem.title : (e as Error).message;
}

export default function RetentionPage() {
  const { orgId } = useParams<{ orgId: string }>();

  const mailboxes = useQuery({
    queryKey: ["mailboxes", orgId],
    queryFn: () => api.get<Mailbox[]>(`/v1/orgs/${orgId}/mailboxes`),
  });

  return (
    <>
      <PageHeader
        title="Retention & holds"
        description="Automatically expunge aged mail, freeze mailboxes under legal hold, and export a full mailbox archive. Pruning and export reach Dovecot as a master user."
      />
      <PageBody>
        <div className="space-y-6">
          <PolicyCard orgId={orgId} />
          <HoldsCard orgId={orgId} mailboxes={mailboxes.data ?? []} />
          <ExportsCard orgId={orgId} mailboxes={mailboxes.data ?? []} />
        </div>
      </PageBody>
    </>
  );
}

function PolicyCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const policy = useQuery({
    queryKey: ["retention", orgId],
    queryFn: () => api.get<RetentionPolicy>(`/v1/orgs/${orgId}/retention`),
  });

  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState("");
  const [folders, setFolders] = useState("");

  useEffect(() => {
    if (policy.data) {
      setEnabled(policy.data.enabled);
      setDays(
        policy.data.delete_after_days === null
          ? ""
          : String(policy.data.delete_after_days),
      );
      setFolders(policy.data.folders.join(", "));
    }
  }, [policy.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/v1/orgs/${orgId}/retention`, {
        enabled,
        delete_after_days: days.trim() === "" ? null : Number(days),
        folders: folders
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retention", orgId] });
      toast({ title: "Retention policy saved", tone: "ok" });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention policy</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {policy.isLoading && <SkeletonRows count={2} />}
        {policy.data && (
          <>
            {!policy.data.master_configured && (
              <div className="flex items-start gap-2 rounded-lg border border-[color:rgb(255_159_10/0.3)] bg-[color:rgb(255_159_10/0.08)] p-3 text-xs">
                <ShieldAlert
                  size={15}
                  className="mt-0.5 shrink-0 text-[var(--color-warn)]"
                />
                <span>
                  Pruning is inactive until a Dovecot master user is configured
                  (<code className="mono">DOVECOT_MASTER_USER</code> /{" "}
                  <code className="mono">DOVECOT_MASTER_PASSWORD</code>). You can
                  still save the policy.
                </span>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled (prune on the hourly worker tick)
            </label>
            <div className="flex flex-wrap items-end gap-4">
              <FormField label="Delete messages older than (days)">
                <Input
                  type="number"
                  min={1}
                  placeholder="keep forever"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Folders to prune (comma-separated)">
              <Input
                placeholder="Trash, Junk"
                value={folders}
                onChange={(e) => setFolders(e.target.value)}
              />
            </FormField>
            <div>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Save policy
              </Button>
            </div>
            <p className="text-xs text-[var(--color-neutral-700)]">
              Mailboxes under an active legal hold are skipped. Leave the age
              blank to keep mail indefinitely.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function HoldsCard({
  orgId,
  mailboxes,
}: {
  orgId: string;
  mailboxes: Mailbox[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const holds = useQuery({
    queryKey: ["legal-holds", orgId],
    queryFn: () => api.get<LegalHold[]>(`/v1/orgs/${orgId}/retention/holds`),
  });

  const [scope, setScope] = useState("");
  const [reason, setReason] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post(`/v1/orgs/${orgId}/retention/holds`, {
        mailbox_id: scope === "" ? null : scope,
        reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-holds", orgId] });
      setReason("");
      setScope("");
      toast({ title: "Legal hold placed", tone: "ok" });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  const release = useMutation({
    mutationFn: (id: string) =>
      api.del(`/v1/orgs/${orgId}/retention/holds/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-holds", orgId] });
      toast({ title: "Hold released", tone: "ok" });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legal holds</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Scope">
            <select
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="">Entire organization</option>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Reason (optional)">
            <Input
              placeholder="Case #, matter…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <Button
            variant="secondary"
            leadingIcon={<Lock size={13} />}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Place hold
          </Button>
        </div>

        {holds.isLoading && <SkeletonRows count={2} />}
        {holds.data && holds.data.length === 0 && (
          <Empty
            title="No legal holds"
            description="Holds freeze mail against retention pruning."
          />
        )}
        {holds.data && holds.data.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Scope</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH> </TH>
              </TR>
            </THead>
            <tbody>
              {holds.data.map((h) => (
                <TR key={h.id}>
                  <TD>
                    {h.mailbox_address ?? (
                      <span className="font-medium">Entire org</span>
                    )}
                  </TD>
                  <TD className="text-xs text-[var(--color-neutral-800)]">
                    {h.reason || "—"}
                  </TD>
                  <TD>
                    {h.released_at ? (
                      <Badge tone="muted">Released</Badge>
                    ) : (
                      <Badge tone="warn">Active</Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    {!h.released_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={release.isPending}
                        onClick={() => {
                          if (confirm("Release this legal hold?"))
                            release.mutate(h.id);
                        }}
                      >
                        Release
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function ExportsCard({
  orgId,
  mailboxes,
}: {
  orgId: string;
  mailboxes: Mailbox[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mailboxId, setMailboxId] = useState("");

  const exports = useQuery({
    queryKey: ["exports", orgId],
    queryFn: () =>
      api.get<MailboxExport[]>(`/v1/orgs/${orgId}/retention/exports`),
    // Poll while any export is still running.
    refetchInterval: (q) =>
      (q.state.data ?? []).some(
        (e) => e.status === "pending" || e.status === "running",
      )
        ? 3000
        : false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/v1/orgs/${orgId}/retention/exports`, {
        mailbox_id: mailboxId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exports", orgId] });
      toast({ title: "Export queued", tone: "ok" });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mailbox exports</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Mailbox">
            <select
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
              value={mailboxId}
              onChange={(e) => setMailboxId(e.target.value)}
            >
              <option value="">Select a mailbox…</option>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.address}
                </option>
              ))}
            </select>
          </FormField>
          <Button
            variant="secondary"
            leadingIcon={<Download size={13} />}
            loading={create.isPending}
            disabled={!mailboxId}
            onClick={() => create.mutate()}
          >
            Export to mbox
          </Button>
        </div>

        {exports.isLoading && <SkeletonRows count={2} />}
        {exports.data && exports.data.length === 0 && (
          <Empty
            title="No exports yet"
            description="Export a full mailbox as a standard .mbox archive."
          />
        )}
        {exports.data && exports.data.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Mailbox</TH>
                <TH>Status</TH>
                <TH>Messages</TH>
                <TH> </TH>
              </TR>
            </THead>
            <tbody>
              {exports.data.map((e) => (
                <TR key={e.id}>
                  <TD>{e.mailbox_address ?? "—"}</TD>
                  <TD>
                    {e.status === "done" && <Badge tone="ok">Done</Badge>}
                    {e.status === "error" && (
                      <Badge tone="bad" title={e.error ?? undefined}>
                        Error
                      </Badge>
                    )}
                    {(e.status === "pending" || e.status === "running") && (
                      <Badge tone="info">{e.status}</Badge>
                    )}
                  </TD>
                  <TD className="text-xs">
                    {e.status === "done" ? e.message_count : "—"}
                  </TD>
                  <TD className="text-right">
                    {e.status === "done" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Download size={13} />}
                        onClick={() =>
                          window.open(
                            `${API_BASE}/v1/orgs/${orgId}/retention/exports/${e.id}/download`,
                          )
                        }
                      >
                        Download
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
