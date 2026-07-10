"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type {
  LdapDirectory,
  LdapDirectoryRequest,
  LdapSyncRun,
  LdapTestResult,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
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
  Textarea,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { Plus, RefreshCw, Settings2 } from "lucide-react";
import { api } from "@/lib/api";

type Role = "owner" | "admin" | "member" | "viewer";
type Encryption = "none" | "starttls" | "ldaps";

interface FormValues {
  name: string;
  enabled: boolean;
  host: string;
  port: number;
  encryption: Encryption;
  verify_tls: boolean;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  user_filter: string;
  group_filter: string;
  email_attribute: string;
  name_attribute: string;
  uid_attribute: string;
  member_attribute: string;
  group_role_map: string;
  default_role: Role;
  deactivate_missing: boolean;
  sync_interval_minutes: number;
}

function roleMapToText(map: Record<string, Role>): string {
  return Object.entries(map)
    .map(([dn, role]) => `${dn} = ${role}`)
    .join("\n");
}

function roleMapFromText(text: string): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const line of text.split("\n")) {
    const eq = line.lastIndexOf("=");
    if (eq < 0) continue;
    const dn = line.slice(0, eq).trim();
    const role = line.slice(eq + 1).trim() as Role;
    if (dn && ["owner", "admin", "member", "viewer"].includes(role)) {
      out[dn] = role;
    }
  }
  return out;
}

function defaults(d?: LdapDirectory): FormValues {
  return {
    name: d?.name ?? "",
    enabled: d?.enabled ?? true,
    host: d?.host ?? "",
    port: d?.port ?? 389,
    encryption: d?.encryption ?? "starttls",
    verify_tls: d?.verify_tls ?? true,
    bind_dn: d?.bind_dn ?? "",
    bind_password: "",
    base_dn: d?.base_dn ?? "",
    user_filter: d?.user_filter ?? "(objectClass=person)",
    group_filter: d?.group_filter ?? "",
    email_attribute: d?.email_attribute ?? "mail",
    name_attribute: d?.name_attribute ?? "cn",
    uid_attribute: d?.uid_attribute ?? "uid",
    member_attribute: d?.member_attribute ?? "memberOf",
    group_role_map: d ? roleMapToText(d.group_role_map as Record<string, Role>) : "",
    default_role: (d?.default_role as Role) ?? "member",
    deactivate_missing: d?.deactivate_missing ?? true,
    sync_interval_minutes: d?.sync_interval_minutes ?? 60,
  };
}

function buildBody(v: FormValues, editing: boolean): LdapDirectoryRequest {
  return {
    name: v.name.trim(),
    enabled: v.enabled,
    host: v.host.trim(),
    port: Number(v.port),
    encryption: v.encryption,
    verify_tls: v.verify_tls,
    bind_dn: v.bind_dn.trim(),
    base_dn: v.base_dn.trim(),
    user_filter: v.user_filter.trim(),
    group_filter: v.group_filter.trim() || undefined,
    email_attribute: v.email_attribute.trim() || "mail",
    name_attribute: v.name_attribute.trim() || "cn",
    uid_attribute: v.uid_attribute.trim() || "uid",
    member_attribute: v.member_attribute.trim() || "memberOf",
    group_role_map: roleMapFromText(v.group_role_map),
    default_role: v.default_role,
    deactivate_missing: v.deactivate_missing,
    sync_interval_minutes: Number(v.sync_interval_minutes),
    // Omit on edit to keep the stored bind password; send when provided.
    ...(v.bind_password || !editing ? { bind_password: v.bind_password } : {}),
  };
}

export default function LdapPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<LdapDirectory | null>(null);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<LdapDirectory | null>(null);

  const list = useQuery({
    queryKey: ["ldap", orgId],
    queryFn: () =>
      api.get<LdapDirectory[]>(`/v1/orgs/${orgId}/ldap/directories`),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api.del(`/v1/orgs/${orgId}/ldap/directories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ldap", orgId] });
      toast({ title: "Directory removed", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Directory sync"
        description="Synchronise members from an LDAP or Active Directory server. Users are provisioned on a schedule and assigned roles by group membership."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setCreating(true)}
          >
            Add directory
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={2} />}
        {list.data && list.data.length === 0 && (
          <Empty
            title="No directories connected"
            description="Connect Active Directory, OpenLDAP, FreeIPA, JumpCloud or any LDAP v3 server."
          />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Host</TH>
                  <TH>Last synced</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <span className="font-medium">{d.name}</span>
                    </TD>
                    <TD className="text-xs">
                      <span className="mono">
                        {d.host}:{d.port}
                      </span>{" "}
                      <Badge tone="neutral">{d.encryption}</Badge>
                    </TD>
                    <TD className="text-xs text-[var(--color-neutral-900)]">
                      {d.last_synced_at
                        ? new Date(d.last_synced_at).toLocaleString()
                        : "Never"}
                    </TD>
                    <TD>
                      <StatusBadge status={d.enabled ? "ok" : "neutral"} />
                    </TD>
                    <TD className="text-right whitespace-nowrap">
                      <button
                        className="text-xs text-[var(--color-accent)] hover:underline mr-3 inline-flex items-center gap-1"
                        onClick={() => setManaging(d)}
                      >
                        <Settings2 size={12} /> Test & sync
                      </button>
                      <button
                        className="text-xs text-[var(--color-neutral-1000)] hover:underline mr-3"
                        onClick={() => setEditing(d)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-[var(--color-bad)] hover:underline"
                        onClick={() => {
                          if (confirm(`Delete "${d.name}"?`)) remove.mutate(d.id);
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

      {creating && (
        <DirectoryModal orgId={orgId} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <DirectoryModal
          orgId={orgId}
          directory={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {managing && (
        <ManageModal
          orgId={orgId}
          directory={managing}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}

function DirectoryModal({
  orgId,
  directory,
  onClose,
}: {
  orgId: string;
  directory?: LdapDirectory;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const editing = !!directory;
  const f = useForm<FormValues>({ defaultValues: defaults(directory) });
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (body: LdapDirectoryRequest) =>
      editing
        ? api.put(`/v1/orgs/${orgId}/ldap/directories/${directory!.id}`, body)
        : api.post(`/v1/orgs/${orgId}/ldap/directories`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ldap", orgId] });
      toast({
        title: editing ? "Directory updated" : "Directory added",
        tone: "ok",
      });
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
      size="lg"
      title={editing ? "Edit directory" : "Add directory"}
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
              mut.mutate(buildBody(v, editing));
            })}
          >
            {editing ? "Save" : "Add directory"}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <FormField label="Display name">
          <Input
            autoFocus
            placeholder="Acme AD"
            {...f.register("name", { required: true })}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField label="Host">
              <Input
                monospace
                placeholder="ldap.acme.com"
                {...f.register("host", { required: true })}
              />
            </FormField>
          </div>
          <FormField label="Port">
            <Input
              type="number"
              monospace
              {...f.register("port", { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <FormField label="Encryption">
            <select
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
              {...f.register("encryption")}
            >
              <option value="starttls">STARTTLS</option>
              <option value="ldaps">LDAPS</option>
              <option value="none">None (plaintext)</option>
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm py-2">
            <input type="checkbox" {...f.register("verify_tls")} />
            Verify TLS certificate
          </label>
        </div>

        <FormField label="Bind DN">
          <Input
            monospace
            placeholder="cn=service,ou=svc,dc=acme,dc=com"
            {...f.register("bind_dn", { required: true })}
          />
        </FormField>
        <FormField
          label={
            editing && directory?.has_bind_password
              ? "Bind password (leave blank to keep current)"
              : "Bind password"
          }
        >
          <Input
            type="password"
            monospace
            autoComplete="off"
            {...f.register("bind_password", {
              required: !editing,
            })}
          />
        </FormField>

        <FormField label="Base DN">
          <Input
            monospace
            placeholder="dc=acme,dc=com"
            {...f.register("base_dn", { required: true })}
          />
        </FormField>
        <FormField label="User filter">
          <Input monospace {...f.register("user_filter", { required: true })} />
        </FormField>
        <FormField label="Group filter (optional, enables nested-group roles)">
          <Input
            monospace
            placeholder="(objectClass=group)"
            {...f.register("group_filter")}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email attribute">
            <Input monospace {...f.register("email_attribute")} />
          </FormField>
          <FormField label="Name attribute">
            <Input monospace {...f.register("name_attribute")} />
          </FormField>
          <FormField label="UID attribute">
            <Input monospace {...f.register("uid_attribute")} />
          </FormField>
          <FormField label="Member-of attribute">
            <Input monospace {...f.register("member_attribute")} />
          </FormField>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
          <FormField label="Group → role map (one per line: group DN = role)">
            <Textarea
              className="mono text-xs min-h-[90px]"
              placeholder={"cn=admins,dc=acme,dc=com = admin\ncn=staff,dc=acme,dc=com = member"}
              {...f.register("group_role_map")}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3 items-end">
            <FormField label="Default role">
              <select
                className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
                {...f.register("default_role")}
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            <FormField label="Sync interval (minutes)">
              <Input
                type="number"
                monospace
                {...f.register("sync_interval_minutes", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...f.register("deactivate_missing")} />
            Suspend accounts removed from the directory
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...f.register("enabled")} />
            Enabled
          </label>
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

function ManageModal({
  orgId,
  directory,
  onClose,
}: {
  orgId: string;
  directory: LdapDirectory;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [test, setTest] = useState<LdapTestResult | null>(null);

  const runs = useQuery({
    queryKey: ["ldap-runs", orgId, directory.id],
    queryFn: () =>
      api.get<LdapSyncRun[]>(
        `/v1/orgs/${orgId}/ldap/directories/${directory.id}/runs`,
      ),
  });
  const testMut = useMutation({
    mutationFn: () =>
      api.post<LdapTestResult>(
        `/v1/orgs/${orgId}/ldap/directories/${directory.id}/test`,
        {},
      ),
    onSuccess: (r) => setTest(r),
  });
  const syncMut = useMutation({
    mutationFn: () =>
      api.post<LdapSyncRun>(
        `/v1/orgs/${orgId}/ldap/directories/${directory.id}/sync`,
        {},
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ldap-runs", orgId, directory.id] });
      qc.invalidateQueries({ queryKey: ["ldap", orgId] });
      toast({
        title:
          r.status === "ok"
            ? `Synced: +${r.created_count} created, ${r.updated_count} updated`
            : `Sync ${r.status}`,
        tone: r.status === "ok" ? "ok" : "bad",
      });
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${directory.name} — test & sync`}
      description="Verify the connection, run a sync on demand, and review recent runs."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={testMut.isPending}
            onClick={() => testMut.mutate()}
          >
            Test connection
          </Button>
          <Button
            variant="primary"
            leadingIcon={<RefreshCw size={14} />}
            loading={syncMut.isPending}
            onClick={() => syncMut.mutate()}
          >
            Sync now
          </Button>
        </div>

        {test && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              test.ok
                ? "border-[var(--color-ok)] bg-[color:rgb(52_199_89/0.08)]"
                : "border-[var(--color-bad)] bg-[color:rgb(255_59_48/0.08)]"
            }`}
          >
            <p className="font-medium">{test.message}</p>
            {test.sample_users.length > 0 && (
              <ul className="mt-2 space-y-1">
                {test.sample_users.map((u, i) => (
                  <li key={i} className="mono">
                    {u.email ?? "—"} {u.name ? `(${u.name})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-neutral-900)] mb-2">
            Recent runs
          </h3>
          {runs.isLoading && <SkeletonRows count={2} />}
          {runs.data && runs.data.length === 0 && (
            <p className="text-xs text-[var(--color-neutral-700)]">
              No sync runs yet.
            </p>
          )}
          {runs.data && runs.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Started</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH>Updated</TH>
                  <TH>Suspended</TH>
                </TR>
              </THead>
              <tbody>
                {runs.data.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-xs">
                      {new Date(r.started_at).toLocaleString()}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          r.status === "ok"
                            ? "ok"
                            : r.status === "error"
                              ? "bad"
                              : "neutral"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TD>
                    <TD className="text-xs">{r.created_count}</TD>
                    <TD className="text-xs">{r.updated_count}</TD>
                    <TD className="text-xs">{r.deactivated_count}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </Modal>
  );
}
