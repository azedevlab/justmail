"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import type {
  ScimConfig,
  ScimConfigRequest,
  ScimTokenResult,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Modal,
  PageBody,
  PageHeader,
  SkeletonRows,
  Textarea,
  useToast,
} from "@justmail/shared-ui";
import { Copy, KeyRound } from "lucide-react";
import { api } from "@/lib/api";

type Role = "owner" | "admin" | "member" | "viewer";

interface FormValues {
  enabled: boolean;
  default_role: Role;
  group_role_map: string;
  deactivate: boolean;
}

function roleMapToText(map: Record<string, Role>): string {
  return Object.entries(map)
    .map(([name, role]) => `${name} = ${role}`)
    .join("\n");
}

function roleMapFromText(text: string): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const line of text.split("\n")) {
    const eq = line.lastIndexOf("=");
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const role = line.slice(eq + 1).trim() as Role;
    if (name && ["owner", "admin", "member", "viewer"].includes(role)) {
      out[name] = role;
    }
  }
  return out;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-900)]">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 mono text-xs break-all p-2 rounded-md bg-[var(--color-neutral-100)] border border-[var(--color-border)]">
          {value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "Copied", tone: "ok" });
          }}
        >
          <Copy size={13} />
        </Button>
      </div>
    </div>
  );
}

export default function ScimPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newToken, setNewToken] = useState<ScimTokenResult | null>(null);

  const cfg = useQuery({
    queryKey: ["scim", orgId],
    queryFn: () => api.get<ScimConfig>(`/v1/orgs/${orgId}/scim`),
  });

  const f = useForm<FormValues>({
    defaultValues: {
      enabled: true,
      default_role: "member",
      group_role_map: "",
      deactivate: true,
    },
  });
  useEffect(() => {
    if (cfg.data) {
      f.reset({
        enabled: cfg.data.enabled,
        default_role: cfg.data.default_role as Role,
        group_role_map: roleMapToText(
          cfg.data.group_role_map as Record<string, Role>,
        ),
        deactivate: cfg.data.deactivate,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: (body: ScimConfigRequest) =>
      api.put(`/v1/orgs/${orgId}/scim`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scim", orgId] });
      toast({ title: "SCIM settings saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError ? e.problem.title : (e as Error).message,
        tone: "bad",
      }),
  });

  const rotate = useMutation({
    mutationFn: () =>
      api.post<ScimTokenResult>(`/v1/orgs/${orgId}/scim/token`, {}),
    onSuccess: (r) => {
      setNewToken(r);
      qc.invalidateQueries({ queryKey: ["scim", orgId] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => api.del(`/v1/orgs/${orgId}/scim/token`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scim", orgId] });
      toast({ title: "Token revoked", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="SCIM provisioning"
        description="Let your identity provider push users and groups to JustMail over SCIM 2.0. Group membership drives org roles; removed users are suspended."
      />
      <PageBody>
        {cfg.isLoading && <SkeletonRows count={2} />}
        {cfg.data && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Endpoint</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <CopyRow label="SCIM base URL" value={cfg.data.base_url} />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-neutral-900)]">
                    Bearer token:
                  </span>
                  {cfg.data.has_token ? (
                    <Badge tone="ok">
                      Active ({cfg.data.token_prefix}…)
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not generated</Badge>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<KeyRound size={13} />}
                      loading={rotate.isPending}
                      onClick={() => rotate.mutate()}
                    >
                      {cfg.data.has_token ? "Rotate token" : "Generate token"}
                    </Button>
                    {cfg.data.has_token && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={revoke.isPending}
                        onClick={() => {
                          if (confirm("Revoke the SCIM token?")) revoke.mutate();
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
                {cfg.data.last_request_at && (
                  <p className="text-xs text-[var(--color-neutral-700)]">
                    Last request{" "}
                    {new Date(cfg.data.last_request_at).toLocaleString()} ·{" "}
                    {cfg.data.user_count} provisioned user(s)
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardBody>
                <form
                  className="space-y-4"
                  onSubmit={f.handleSubmit((v) =>
                    save.mutate({
                      enabled: v.enabled,
                      default_role: v.default_role,
                      group_role_map: roleMapFromText(v.group_role_map),
                      deactivate: v.deactivate,
                    }),
                  )}
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...f.register("enabled")} />
                    Enabled (accept SCIM requests)
                  </label>
                  <FormField label="Default role for new members">
                    <select
                      className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
                      {...f.register("default_role")}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </FormField>
                  <FormField label="Group → role map (one per line: group name = role)">
                    <Textarea
                      className="mono text-xs min-h-[90px]"
                      placeholder={"Admins = admin\nStaff = member"}
                      {...f.register("group_role_map")}
                    />
                  </FormField>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...f.register("deactivate")} />
                    Suspend accounts on deprovision (active=false / delete)
                  </label>
                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={save.isPending}
                    >
                      Save settings
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        )}
      </PageBody>

      {newToken && (
        <Modal
          open
          onClose={() => setNewToken(null)}
          title="SCIM token generated"
          description="Copy this token now — it is shown only once. Paste it into your identity provider's SCIM connector."
          footer={
            <Button variant="primary" onClick={() => setNewToken(null)}>
              Done
            </Button>
          }
        >
          <div className="space-y-4">
            <CopyRow label="Bearer token" value={newToken.token} />
            <CopyRow label="SCIM base URL" value={newToken.base_url} />
          </div>
        </Modal>
      )}
    </>
  );
}
