"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateMailGroupRequest,
  Domain,
  MailGroup,
  MailGroupDetail,
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
  Spinner,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useConfirm,
  useToast,
} from "@justmail/shared-ui";
import { Plus, Users } from "lucide-react";
import { api } from "@/lib/api";

function parseMembers(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { toast } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["groups", orgId],
    queryFn: () => api.get<MailGroup[]>(`/v1/orgs/${orgId}/groups`),
  });
  const domains = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", orgId] });
      toast({ title: "Group deleted", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Groups"
        description="Distribution lists — one address that delivers to every member."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowCreate(true)}
          >
            Add group
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={3} />}
        {list.data && list.data.length === 0 && (
          <Empty
            title="No groups yet"
            description="Create a group address, add members, and mail sent to it fans out to everyone."
            action={
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                Add your first group
              </Button>
            }
          />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Group</TH>
                  <TH>Name</TH>
                  <TH>Members</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((g) => (
                  <TR key={g.id}>
                    <TD>
                      <span className="mono">{g.address}</span>
                    </TD>
                    <TD>{g.name}</TD>
                    <TD>{g.member_count}</TD>
                    <TD>
                      <StatusBadge status={g.enabled ? "active" : "disabled"} />
                    </TD>
                    <TD className="text-right whitespace-nowrap">
                      <button
                        className="text-xs text-[var(--color-accent)] hover:underline"
                        onClick={() => setManageId(g.id)}
                      >
                        Manage
                      </button>
                      <button
                        className="ml-3 text-xs text-[var(--color-bad)] hover:underline"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `Delete group ${g.address}?`,
                              body: "Mail sent to this address will stop being delivered.",
                              tone: "danger",
                              confirmLabel: "Delete",
                            })
                          )
                            del.mutate(g.id);
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
        <CreateModal
          orgId={orgId}
          domains={domains.data ?? []}
          loading={domains.isLoading}
          onClose={() => setShowCreate(false)}
        />
      )}
      {manageId && (
        <ManageModal
          orgId={orgId}
          id={manageId}
          onClose={() => setManageId(null)}
        />
      )}
    </>
  );
}

function CreateModal({
  orgId,
  domains,
  loading,
  onClose,
}: {
  orgId: string;
  domains: Domain[];
  loading: boolean;
  onClose: () => void;
}) {
  if (loading || domains.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Add group"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size={22} />
          </div>
        ) : (
          <Empty
            title="No domains yet"
            description="Add and verify a domain before creating groups."
          />
        )}
      </Modal>
    );
  }
  return <CreateForm orgId={orgId} domains={domains} onClose={onClose} />;
}

function CreateForm({
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
  const [err, setErr] = useState<string | null>(null);
  const f = useForm<{
    local_part: string;
    domain_id: string;
    name: string;
    description: string;
    members: string;
    allow_member_send: boolean;
  }>({
    defaultValues: {
      local_part: "",
      domain_id: domains[0].id,
      name: "",
      description: "",
      members: "",
      allow_member_send: false,
    },
  });
  const mut = useMutation({
    mutationFn: (body: CreateMailGroupRequest & { domain_id: string }) => {
      const { domain_id, ...rest } = body;
      return api.post<MailGroupDetail>(
        `/v1/orgs/${orgId}/domains/${domain_id}/groups`,
        rest,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", orgId] });
      toast({ title: "Group created", tone: "ok" });
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
      title="Add group"
      description="Members can be any address — internal mailboxes or external contacts."
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
                local_part: v.local_part.trim().toLowerCase(),
                domain_id: v.domain_id,
                name: v.name.trim(),
                description: v.description.trim() || undefined,
                members: parseMembers(v.members),
                allow_member_send: v.allow_member_send,
              });
            })}
          >
            Create group
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Address">
          <div className="flex gap-2">
            <Input
              placeholder="team"
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
        <FormField label="Name">
          <Input
            placeholder="Team distribution list"
            {...f.register("name", { required: true })}
          />
        </FormField>
        <FormField label="Description" hint="Optional">
          <Input placeholder="What this group is for" {...f.register("description")} />
        </FormField>
        <FormField label="Members" hint="Comma, space, or newline separated">
          <textarea
            className="w-full min-h-24 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] font-mono outline-none focus:border-[var(--color-accent)] transition-colors resize-y"
            placeholder="alice@example.com bob@example.com"
            {...f.register("members")}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
          <input type="checkbox" {...f.register("allow_member_send")} />
          Let members send mail using the group address
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

function ManageModal({
  orgId,
  id,
  onClose,
}: {
  orgId: string;
  id: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const group = useQuery({
    queryKey: ["group", orgId, id],
    queryFn: () => api.get<MailGroupDetail>(`/v1/orgs/${orgId}/groups/${id}`),
  });

  const save = useMutation({
    mutationFn: async (v: {
      name: string;
      description: string;
      enabled: boolean;
      allow_member_send: boolean;
      members: string[];
    }) => {
      await api.patch(`/v1/orgs/${orgId}/groups/${id}`, {
        name: v.name,
        description: v.description || null,
        enabled: v.enabled,
        allow_member_send: v.allow_member_send,
      });
      await api.put(`/v1/orgs/${orgId}/groups/${id}/members`, {
        members: v.members,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", orgId] });
      qc.invalidateQueries({ queryKey: ["group", orgId, id] });
      toast({ title: "Group saved", tone: "ok" });
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
      title={group.data ? group.data.address : "Manage group"}
      description="Edit membership and delivery settings."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!group.data}
            onClick={() => {
              const form = document.getElementById(
                "group-manage-form",
              ) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      {group.isLoading || !group.data ? (
        <div className="flex justify-center py-6">
          <Spinner size={22} />
        </div>
      ) : (
        <ManageForm
          group={group.data}
          err={err}
          onSubmit={(v) => {
            setErr(null);
            save.mutate(v);
          }}
        />
      )}
    </Modal>
  );
}

function ManageForm({
  group,
  err,
  onSubmit,
}: {
  group: MailGroupDetail;
  err: string | null;
  onSubmit: (v: {
    name: string;
    description: string;
    enabled: boolean;
    allow_member_send: boolean;
    members: string[];
  }) => void;
}) {
  const f = useForm({
    defaultValues: {
      name: group.name,
      description: group.description ?? "",
      enabled: group.enabled,
      allow_member_send: group.allow_member_send,
      members: group.members.map((m) => m.address).join("\n"),
    },
  });
  return (
    <form
      id="group-manage-form"
      className="space-y-3"
      onSubmit={f.handleSubmit((v) =>
        onSubmit({
          name: v.name.trim(),
          description: v.description.trim(),
          enabled: v.enabled,
          allow_member_send: v.allow_member_send,
          members: parseMembers(v.members),
        }),
      )}
    >
      <FormField label="Name">
        <Input {...f.register("name", { required: true })} />
      </FormField>
      <FormField label="Description" hint="Optional">
        <Input {...f.register("description")} />
      </FormField>
      <FormField
        label={`Members (${group.member_count})`}
        hint="Comma, space, or newline separated"
      >
        <textarea
          className="w-full min-h-32 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-3 py-2 text-[13px] font-mono outline-none focus:border-[var(--color-accent)] transition-colors resize-y"
          {...f.register("members")}
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
        <input type="checkbox" {...f.register("enabled")} />
        Enabled
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
        <input type="checkbox" {...f.register("allow_member_send")} />
        Let members send mail using the group address
      </label>
      {err && (
        <p className="text-xs text-[var(--color-bad)]" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
