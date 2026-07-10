"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateMailboxRequest,
  Domain,
  Mailbox,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
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
  SkeletonRows,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { Mail, MoreVertical, Plus, Search } from "lucide-react";
import { api, API_BASE } from "@/lib/api";

export default function MailboxesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
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
                            onSelect={() => {
                              if (confirm(`Delete ${m.address}?`)) del.mutate(m.id);
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
            <select
              className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
              {...f.register("domain_id", { required: true })}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  @{d.name}
                </option>
              ))}
            </select>
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
