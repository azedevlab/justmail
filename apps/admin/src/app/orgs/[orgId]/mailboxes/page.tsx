"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateMailboxRequest,
  Domain,
  Mailbox,
  UpdateMailboxRequest,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DropdownItem,
  DropdownMenu,
  Empty,
  FormField,
  IconButton,
  Input,
  Modal,
  PageBody,
  PageHeader,
  Progress,
  Select,
  SkeletonRows,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useConfirm,
  useToast,
} from "@justmail/shared-ui";
import { Mail, MoreVertical, Plus, Search } from "lucide-react";
import { api, API_BASE } from "@/lib/api";

export default function MailboxesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [editBox, setEditBox] = useState<Mailbox | null>(null);
  const [pwBox, setPwBox] = useState<Mailbox | null>(null);
  const [filter, setFilter] = useState("");
  const list = useQuery({
    queryKey: ["mailboxes", orgId],
    queryFn: () => api.get<Mailbox[]>(`/v1/orgs/${orgId}/mailboxes`),
  });
  const domains = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/mailboxes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mailboxes", orgId] });
      toast({ title: "Mailbox deleted", tone: "ok" });
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; status: "active" | "suspended" }) =>
      api.patch(`/v1/orgs/${orgId}/mailboxes/${v.id}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailboxes", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Mailboxes"
        description="Users, quotas, forwarding, autoresponders."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => window.open(`${API_BASE}/v1/orgs/${orgId}/mailboxes.csv`)}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowCreate(true)}
              leadingIcon={<Plus size={14} />}
            >
              Add mailbox
            </Button>
          </>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={5} />}
        {list.data && list.data.length === 0 && (
          <Empty
            icon={<Mail size={20} />}
            title="No mailboxes yet"
            description="Create a mailbox to give someone an address on one of your domains."
            action={
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                Add your first mailbox
              </Button>
            }
          />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Search size={14} className="text-[var(--color-neutral-700)]" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by address or name…"
                aria-label="Filter mailboxes"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--color-neutral-700)]"
              />
              <span className="text-xs text-[var(--color-neutral-800)] tabular-nums">
                {list.data.length} total
              </span>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Address</TH>
                  <TH>Name</TH>
                  <TH>Quota</TH>
                  <TH>Status</TH>
                  <TH>Protocols</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data
                  .filter(
                    (m) =>
                      !filter ||
                      m.address.toLowerCase().includes(filter.toLowerCase()) ||
                      (m.name ?? "").toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((m) => {
                  const usedMb = m.quota_used_bytes / 1024 / 1024;
                  const pct = m.quota_mb > 0 ? (usedMb / m.quota_mb) * 100 : 0;
                  return (
                    <TR key={m.id}>
                      <TD>
                        <span className="font-medium">{m.address}</span>
                      </TD>
                      <TD className="text-[var(--color-neutral-900)]">{m.name || "—"}</TD>
                      <TD>
                        <div className="w-32">
                          <div className="text-xs tabular-nums text-[var(--color-neutral-900)] mb-1">
                            {usedMb.toFixed(0)} / {m.quota_mb} MB
                          </div>
                          <Progress
                            value={usedMb}
                            max={m.quota_mb}
                            tone={pct > 90 ? "bad" : pct > 75 ? "warn" : "brand"}
                          />
                        </div>
                      </TD>
                      <TD>
                        <StatusBadge status={m.status} />
                      </TD>
                      <TD>
                        <div className="flex gap-1">
                          {m.imap_enabled && <Badge tone="muted">IMAP</Badge>}
                          {m.pop3_enabled && <Badge tone="muted">POP3</Badge>}
                          {m.smtp_enabled && <Badge tone="muted">SMTP</Badge>}
                        </div>
                      </TD>
                      <TD className="text-right">
                        <DropdownMenu
                          trigger={
                            <IconButton size="sm" aria-label={`Actions for ${m.address}`}>
                              <MoreVertical size={14} />
                            </IconButton>
                          }
                        >
                          <DropdownItem onSelect={() => setEditBox(m)}>
                            Edit
                          </DropdownItem>
                          <DropdownItem onSelect={() => setPwBox(m)}>
                            Reset password
                          </DropdownItem>
                          <DropdownItem
                            onSelect={() =>
                              toggle.mutate({
                                id: m.id,
                                status:
                                  m.status === "active" ? "suspended" : "active",
                              })
                            }
                          >
                            {m.status === "active" ? "Suspend" : "Resume"}
                          </DropdownItem>
                          <DropdownItem
                            destructive
                            onSelect={async () => {
                              if (
                                await confirm({
                                  title: `Delete ${m.address}?`,
                                  tone: "danger",
                                  confirmLabel: "Delete",
                                })
                              )
                                del.mutate(m.id);
                            }}
                          >
                            Delete
                          </DropdownItem>
                        </DropdownMenu>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </PageBody>
      {showCreate && domains.data && (
        <CreateModal
          orgId={orgId}
          domains={domains.data}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editBox && (
        <EditModal
          orgId={orgId}
          mailbox={editBox}
          onClose={() => setEditBox(null)}
        />
      )}
      {pwBox && (
        <PasswordModal
          orgId={orgId}
          mailbox={pwBox}
          onClose={() => setPwBox(null)}
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
  const { toast } = useToast();
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
      toast({ title: "Mailbox created", tone: "ok" });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add mailbox"
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
              mut.mutate({
                ...v,
                local_part: v.local_part.toLowerCase(),
              });
            })}
          >
            Create mailbox
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Address">
          <div className="flex gap-2">
            <Input
              placeholder="local-part"
              autoFocus
              monospace
              {...f.register("local_part", { required: true })}
            />
            <Select
              className="!w-auto"
              {...f.register("domain_id", { required: true })}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  @{d.name}
                </option>
              ))}
            </Select>
          </div>
        </FormField>
        <FormField label="Display name">
          <Input {...f.register("name")} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Password (min 10)">
            <Input
              type="password"
              {...f.register("password", { required: true, minLength: 10 })}
            />
          </FormField>
          <FormField label="Quota (MB)">
            <Input
              type="number"
              monospace
              min={0}
              {...f.register("quota_mb", { valueAsNumber: true, min: 0 })}
            />
          </FormField>
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

function EditModal({
  orgId,
  mailbox,
  onClose,
}: {
  orgId: string;
  mailbox: Mailbox;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const f = useForm<{
    name: string;
    quota_mb: number;
    imap_enabled: boolean;
    pop3_enabled: boolean;
    smtp_enabled: boolean;
    sieve_enabled: boolean;
    forward_to: string;
    forward_keep_copy: boolean;
  }>({
    defaultValues: {
      name: mailbox.name,
      quota_mb: mailbox.quota_mb,
      imap_enabled: mailbox.imap_enabled,
      pop3_enabled: mailbox.pop3_enabled,
      smtp_enabled: mailbox.smtp_enabled,
      sieve_enabled: mailbox.sieve_enabled,
      forward_to: mailbox.forward_to.join(", "),
      forward_keep_copy: mailbox.forward_keep_copy,
    },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: UpdateMailboxRequest) =>
      api.patch<Mailbox>(`/v1/orgs/${orgId}/mailboxes/${mailbox.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mailboxes", orgId] });
      toast({ title: "Mailbox updated", tone: "ok" });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${mailbox.address}`}
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
              const forward_to = v.forward_to
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              mut.mutate({
                name: v.name,
                quota_mb: v.quota_mb,
                imap_enabled: v.imap_enabled,
                pop3_enabled: v.pop3_enabled,
                smtp_enabled: v.smtp_enabled,
                sieve_enabled: v.sieve_enabled,
                forward_to,
                forward_keep_copy: v.forward_keep_copy,
              });
            })}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Display name">
            <Input {...f.register("name")} />
          </FormField>
          <FormField label="Quota (MB)">
            <Input
              type="number"
              monospace
              min={0}
              {...f.register("quota_mb", { valueAsNumber: true, min: 0 })}
            />
          </FormField>
        </div>
        <FormField label="Protocols">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
              <Checkbox {...f.register("imap_enabled")} /> IMAP
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
              <Checkbox {...f.register("pop3_enabled")} /> POP3
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
              <Checkbox {...f.register("smtp_enabled")} /> SMTP
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
              <Checkbox {...f.register("sieve_enabled")} /> Sieve
            </label>
          </div>
        </FormField>
        <FormField
          label="Forward to"
          hint="Comma or space separated. Leave blank to disable forwarding."
        >
          <Input
            monospace
            placeholder="alice@example.com bob@example.com"
            {...f.register("forward_to")}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
          <Checkbox {...f.register("forward_keep_copy")} />
          Keep a copy in this mailbox when forwarding
        </label>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}

function PasswordModal({
  orgId,
  mailbox,
  onClose,
}: {
  orgId: string;
  mailbox: Mailbox;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const f = useForm<{ password: string }>({
    defaultValues: { password: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (password: string) =>
      api.put(`/v1/orgs/${orgId}/mailboxes/${mailbox.id}/password`, {
        password,
      }),
    onSuccess: () => {
      toast({ title: "Password reset", tone: "ok" });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password — ${mailbox.address}`}
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
              mut.mutate(v.password);
            })}
          >
            Set password
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="New password (min 10)">
          <Input
            type="password"
            autoFocus
            {...f.register("password", { required: true, minLength: 10 })}
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
