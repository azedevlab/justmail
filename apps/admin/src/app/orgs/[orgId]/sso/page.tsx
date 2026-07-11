"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { SsoProvider, SsoProviderRequest } from "@justmail/contracts";
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
import { Copy, Plus, Settings2 } from "lucide-react";
import { api } from "@/lib/api";

type Role = "owner" | "admin" | "member" | "viewer";

interface FormValues {
  kind: "oidc" | "saml";
  name: string;
  email_domain: string;
  enabled: boolean;
  auto_provision: boolean;
  default_role: Role;
  // OIDC
  issuer: string;
  client_id: string;
  client_secret: string;
  scopes: string;
  email_claim: string;
  name_claim: string;
  // SAML
  entry_point: string;
  idp_issuer: string;
  idp_cert: string;
  email_attribute: string;
  name_attribute: string;
  signature_algorithm: "sha256" | "sha512";
  want_assertions_signed: boolean;
}

function defaults(p?: SsoProvider): FormValues {
  return {
    kind: p?.kind ?? "oidc",
    name: p?.name ?? "",
    email_domain: p?.email_domain ?? "",
    enabled: p?.enabled ?? true,
    auto_provision: p?.auto_provision ?? true,
    default_role: (p?.default_role as Role) ?? "member",
    issuer: p?.oidc?.issuer ?? "",
    client_id: p?.oidc?.client_id ?? "",
    client_secret: "",
    scopes: p?.oidc?.scopes.join(" ") ?? "openid email profile",
    email_claim: p?.oidc?.email_claim ?? "email",
    name_claim: p?.oidc?.name_claim ?? "name",
    entry_point: p?.saml?.entry_point ?? "",
    idp_issuer: p?.saml?.idp_issuer ?? "",
    idp_cert: p?.saml?.idp_cert ?? "",
    email_attribute: p?.saml?.email_attribute ?? "email",
    name_attribute: p?.saml?.name_attribute ?? "displayName",
    signature_algorithm: p?.saml?.signature_algorithm ?? "sha256",
    want_assertions_signed: p?.saml?.want_assertions_signed ?? true,
  };
}

function buildBody(v: FormValues, editing: boolean): SsoProviderRequest {
  const routing = {
    name: v.name,
    enabled: v.enabled,
    email_domain: v.email_domain.trim() || undefined,
    auto_provision: v.auto_provision,
    default_role: v.default_role,
  };
  if (v.kind === "oidc") {
    const scopes = v.scopes.split(/[\s,]+/).filter(Boolean);
    return {
      kind: "oidc",
      ...routing,
      oidc: {
        issuer: v.issuer.trim(),
        client_id: v.client_id.trim(),
        scopes: scopes.length ? scopes : ["openid", "email", "profile"],
        email_claim: v.email_claim.trim() || "email",
        name_claim: v.name_claim.trim() || "name",
      },
      // Omit on edit to preserve the stored secret; send on create/change.
      ...(v.client_secret || !editing
        ? { client_secret: v.client_secret }
        : {}),
    };
  }
  return {
    kind: "saml",
    ...routing,
    saml: {
      entry_point: v.entry_point.trim(),
      idp_issuer: v.idp_issuer.trim(),
      idp_cert: v.idp_cert.trim(),
      email_attribute: v.email_attribute.trim() || "email",
      name_attribute: v.name_attribute.trim() || "displayName",
      want_assertions_signed: v.want_assertions_signed,
      signature_algorithm: v.signature_algorithm,
    },
  };
}

export default function SsoPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<SsoProvider | null>(null);
  const [creating, setCreating] = useState(false);
  const [endpoints, setEndpoints] = useState<SsoProvider | null>(null);

  const list = useQuery({
    queryKey: ["sso", orgId],
    queryFn: () => api.get<SsoProvider[]>(`/v1/orgs/${orgId}/sso/providers`),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api.del(`/v1/orgs/${orgId}/sso/providers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso", orgId] });
      toast({ title: "Provider removed", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Single sign-on"
        description="Let members authenticate through your OIDC or SAML identity provider. Providers are matched to an email domain at login."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setCreating(true)}
          >
            Add provider
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={2} />}
        {list.data && list.data.length === 0 && (
          <Empty
            title="No identity providers"
            description="Connect Okta, Entra ID, Google Workspace, Auth0, Keycloak or any OIDC/SAML IdP."
          />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH>Domain</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <span className="font-medium">{p.name}</span>
                    </TD>
                    <TD>
                      <Badge tone="brand">{p.kind.toUpperCase()}</Badge>
                    </TD>
                    <TD className="text-xs">
                      {p.email_domain ? (
                        <span className="mono">{p.email_domain}</span>
                      ) : (
                        <span className="text-[var(--color-neutral-700)]">—</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={p.enabled ? "ok" : "neutral"} />
                    </TD>
                    <TD className="text-right whitespace-nowrap">
                      <button
                        className="text-xs text-[var(--color-accent)] hover:underline mr-3 inline-flex items-center gap-1"
                        onClick={() => setEndpoints(p)}
                      >
                        <Settings2 size={12} /> Setup
                      </button>
                      <button
                        className="text-xs text-[var(--color-neutral-1000)] hover:underline mr-3"
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-xs text-[var(--color-bad)] hover:underline"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) remove.mutate(p.id);
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
        <ProviderModal orgId={orgId} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ProviderModal
          orgId={orgId}
          provider={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {endpoints && (
        <EndpointsModal
          provider={endpoints}
          onClose={() => setEndpoints(null)}
        />
      )}
    </>
  );
}

function ProviderModal({
  orgId,
  provider,
  onClose,
}: {
  orgId: string;
  provider?: SsoProvider;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const editing = !!provider;
  const f = useForm<FormValues>({ defaultValues: defaults(provider) });
  const kind = f.watch("kind");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (body: SsoProviderRequest) =>
      editing
        ? api.put(`/v1/orgs/${orgId}/sso/providers/${provider!.id}`, body)
        : api.post(`/v1/orgs/${orgId}/sso/providers`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso", orgId] });
      toast({ title: editing ? "Provider updated" : "Provider added", tone: "ok" });
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
      title={editing ? "Edit provider" : "Add identity provider"}
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
            {editing ? "Save" : "Add provider"}
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        {!editing && (
          <div className="flex gap-2">
            {(["oidc", "saml"] as const).map((k) => (
              <label
                key={k}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
                  kind === k
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <input
                  type="radio"
                  value={k}
                  className="sr-only"
                  {...f.register("kind")}
                />
                {k.toUpperCase()}
              </label>
            ))}
          </div>
        )}

        <FormField label="Display name">
          <Input
            autoFocus
            placeholder="Acme Okta"
            {...f.register("name", { required: true })}
          />
        </FormField>

        <FormField label="Email domain (routes login)">
          <Input
            monospace
            placeholder="acme.com"
            {...f.register("email_domain")}
          />
        </FormField>

        {kind === "oidc" ? (
          <>
            <FormField label="Issuer URL">
              <Input
                monospace
                placeholder="https://acme.okta.com"
                {...f.register("issuer", { required: kind === "oidc" })}
              />
            </FormField>
            <FormField label="Client ID">
              <Input monospace {...f.register("client_id", { required: kind === "oidc" })} />
            </FormField>
            <FormField
              label={
                editing && provider?.has_secret
                  ? "Client secret (leave blank to keep current)"
                  : "Client secret (optional for PKCE-only clients)"
              }
            >
              <Input
                type="password"
                monospace
                autoComplete="off"
                {...f.register("client_secret")}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email claim">
                <Input monospace {...f.register("email_claim")} />
              </FormField>
              <FormField label="Name claim">
                <Input monospace {...f.register("name_claim")} />
              </FormField>
            </div>
            <FormField label="Scopes">
              <Input monospace {...f.register("scopes")} />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="IdP SSO URL (entry point)">
              <Input
                monospace
                placeholder="https://idp.acme.com/sso/saml"
                {...f.register("entry_point", { required: kind === "saml" })}
              />
            </FormField>
            <FormField label="IdP issuer / Entity ID">
              <Input monospace {...f.register("idp_issuer", { required: kind === "saml" })} />
            </FormField>
            <FormField label="IdP signing certificate (PEM or base64)">
              <Textarea
                className="mono text-xs min-h-[120px]"
                placeholder="-----BEGIN CERTIFICATE-----&#10;…"
                {...f.register("idp_cert", { required: kind === "saml" })}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email attribute">
                <Input monospace {...f.register("email_attribute")} />
              </FormField>
              <FormField label="Name attribute">
                <Input monospace {...f.register("name_attribute")} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <FormField label="Signature algorithm">
                <select
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
                  {...f.register("signature_algorithm")}
                >
                  <option value="sha256">SHA-256</option>
                  <option value="sha512">SHA-512</option>
                </select>
              </FormField>
              <label className="flex items-center gap-2 text-sm py-2">
                <input type="checkbox" {...f.register("want_assertions_signed")} />
                Require signed assertions
              </label>
            </div>
          </>
        )}

        <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 items-end">
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
            <label className="flex items-center gap-2 text-sm py-2">
              <input type="checkbox" {...f.register("auto_provision")} />
              Auto-provision accounts
            </label>
          </div>
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

function EndpointsModal({
  provider,
  onClose,
}: {
  provider: SsoProvider;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${provider.name} — IdP setup`}
      description="Register these service-provider endpoints in your identity provider."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        {provider.kind === "oidc" ? (
          <>
            <CopyRow label="Redirect URI (callback)" value={provider.callback_url} />
            <CopyRow label="Login URL" value={provider.login_url} />
          </>
        ) : (
          <>
            <CopyRow label="ACS URL (Assertion Consumer Service)" value={provider.acs_url} />
            <CopyRow label="SP Entity ID" value={provider.metadata_url} />
            <CopyRow label="SP metadata" value={provider.metadata_url} />
            <CopyRow label="Login URL" value={provider.login_url} />
          </>
        )}
      </div>
    </Modal>
  );
}
