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
} from "@justmail/types";
import { api, ApiError, API_BASE } from "../../../../lib/api";
import { PageBody, PageHeader, StatusBadge } from "../../../../components/shell";
import { Modal } from "../domains/page";

export default function TeamPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);

  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => api.get<OrgMember[]>(`/v1/orgs/${orgId}/members`),
  });
  const invites = useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => api.get<Invite[]>(`/v1/orgs/${orgId}/invites`),
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites", orgId] }),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.del(`/v1/orgs/${orgId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });
  const updateRole = useMutation({
    mutationFn: (v: { userId: string; role: OrgRole }) =>
      api.patch(`/v1/orgs/${orgId}/members/${v.userId}`, { role: v.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", orgId] }),
  });

  return (
    <>
      <PageHeader
        title="Team"
        description="Members of this organization and their roles. Invites are email-less for now: copy the link and share it."
        actions={
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            + Invite user
          </button>
        }
      />
      <PageBody>
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 text-sm font-medium">Members</div>
          <table className="data">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.data?.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <div>{m.name || m.email}</div>
                    <div className="text-xs mono text-[var(--color-ink-300)]">
                      {m.email}
                    </div>
                  </td>
                  <td>
                    <select
                      className="select w-32"
                      value={m.role}
                      onChange={(e) =>
                        updateRole.mutate({ userId: m.user_id, role: e.target.value as OrgRole })
                      }
                    >
                      {(["owner", "admin", "member", "viewer"] as const).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-xs text-[var(--color-ink-300)]">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <button
                      className="text-xs text-[var(--color-bad-500)] hover:underline"
                      onClick={() => {
                        if (confirm(`Remove ${m.email} from this org?`))
                          removeMember.mutate(m.user_id);
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invites.data && invites.data.length > 0 && (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5 text-sm font-medium">
              Pending invites
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.data.map((i) => (
                  <tr key={i.id}>
                    <td className="mono text-xs">{i.email}</td>
                    <td>
                      <span className="badge badge-muted">{i.role}</span>
                    </td>
                    <td>
                      <StatusBadge
                        status={i.accepted_at ? "accepted" : "pending"}
                      />
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      {!i.accepted_at && (
                        <button
                          className="text-xs text-[var(--color-bad-500)] hover:underline"
                          onClick={() => revokeInvite.mutate(i.id)}
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

        {showInvite && (
          <InviteModal orgId={orgId} onClose={() => setShowInvite(false)} />
        )}
      </PageBody>
    </>
  );
}

function InviteModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
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
        e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message,
      ),
  });
  if (token) {
    const link = `${window.location.origin}/invite/${token}`;
    return (
      <Modal onClose={onClose} title="Invite created">
        <p className="text-xs text-[var(--color-ink-300)] mb-3">
          Share this link with the invitee. It expires in 14 days.
        </p>
        <div className="card p-3 mono text-xs break-all">{link}</div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            className="btn btn-secondary"
            onClick={() => navigator.clipboard.writeText(link)}
          >
            Copy link
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }
  void API_BASE;
  return (
    <Modal onClose={onClose} title="Invite user">
      <form
        className="space-y-3"
        onSubmit={f.handleSubmit((v) => {
          setErr(null);
          mut.mutate(v);
        })}
      >
        <label className="block">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoFocus
            {...f.register("email", { required: true })}
          />
        </label>
        <label className="block">
          <span className="label">Role</span>
          <select className="select" {...f.register("role", { required: true })}>
            {(["owner", "admin", "member", "viewer"] as const).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={mut.isPending}>
            {mut.isPending ? "Inviting…" : "Create invite"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
