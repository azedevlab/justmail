"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateInviteRequest,
  Invite,
  OrgMember,
  OrgRole,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
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

export default function TeamPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);

  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.get<OrgMember[]>(`/v1/orgs/${orgId}/members`),
  });
  const invites = useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => api.get<Invite[]>(`/v1/orgs/${orgId}/invites`),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/invites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites", orgId] });
      toast({ title: "Invite revoked", tone: "ok" });
    },
  });
  const updateRole = useMutation({
    mutationFn: (v: { userId: string; role: OrgRole }) =>
      api.patch(`/v1/orgs/${orgId}/members/${v.userId}`, { role: v.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.del(`/v1/orgs/${orgId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Team"
        description="Members of this organization, their roles, and pending invites."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowInvite(true)}
          >
            Invite user
          </Button>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardBody>
            {members.isLoading && <SkeletonRows count={3} />}
            {members.data && members.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>User</TH>
                    <TH>Role</TH>
                    <TH>Joined</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <tbody>
                  {members.data.map((m) => (
                    <TR key={m.user_id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Avatar name={m.name || m.email} size={26} />
                          <div>
                            <div className="font-medium">
                              {m.name || m.email}
                            </div>
                            <div className="text-[11px] mono text-[var(--color-neutral-900)]">
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateRole.mutate({
                              userId: m.user_id,
                              role: e.target.value as OrgRole,
                            })
                          }
                          className="px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
                        >
                          {(["owner", "admin", "member", "viewer"] as const).map(
                            (r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ),
                          )}
                        </select>
                      </TD>
                      <TD className="text-xs">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TD>
                      <TD className="text-right">
                        <button
                          className="text-xs text-[var(--color-bad)] hover:underline"
                          onClick={() => {
                            if (confirm(`Remove ${m.email}?`))
                              removeMember.mutate(m.user_id);
                          }}
                        >
                          Remove
                        </button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        {invites.data && invites.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending invites</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <THead>
                  <TR>
                    <TH>Email</TH>
                    <TH>Role</TH>
                    <TH>Status</TH>
                    <TH>Expires</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <tbody>
                  {invites.data.map((i) => (
                    <TR key={i.id}>
                      <TD>
                        <span className="mono text-xs">{i.email}</span>
                      </TD>
                      <TD>
                        <Badge tone="muted">{i.role}</Badge>
                      </TD>
                      <TD>
                        <StatusBadge
                          status={i.accepted_at ? "active" : "pending"}
                        />
                      </TD>
                      <TD className="text-xs">
                        {new Date(i.expires_at).toLocaleDateString()}
                      </TD>
                      <TD className="text-right">
                        {!i.accepted_at && (
                          <button
                            className="text-xs text-[var(--color-bad)] hover:underline"
                            onClick={() => revoke.mutate(i.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        )}

        {invites.data && members.data && members.data.length === 0 && invites.data.length === 0 && (
          <Empty title="No members or invites" />
        )}
      </PageBody>
      {showInvite && (
        <InviteModal orgId={orgId} onClose={() => setShowInvite(false)} />
      )}
    </>
  );
}

function InviteModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const f = useForm<CreateInviteRequest>({
    defaultValues: { email: "", role: "member" },
  });
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateInviteRequest) =>
      api.post<{ invite: Invite; token: string }>(
        `/v1/orgs/${orgId}/invites`,
        body,
      ),
    onSuccess: (r) => {
      setToken(r.token);
      qc.invalidateQueries({ queryKey: ["invites", orgId] });
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });
  if (token) {
    const link = `${window.location.origin}/invite/${token}`;
    return (
      <Modal
        open
        onClose={onClose}
        title="Invite created"
        description="Share this link with the invitee — it expires in 14 days."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast({ title: "Link copied", tone: "ok" });
              }}
            >
              Copy link
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="mono text-xs break-all p-3 rounded-md bg-[var(--color-neutral-100)] border border-[var(--color-border)]">
          {link}
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Invite user"
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
              mut.mutate(v);
            })}
          >
            Create invite
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Email">
          <Input
            type="email"
            autoFocus
            {...f.register("email", { required: true })}
          />
        </FormField>
        <FormField label="Role">
          <select
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
            {...f.register("role", { required: true })}
          >
            {(["owner", "admin", "member", "viewer"] as const).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
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
