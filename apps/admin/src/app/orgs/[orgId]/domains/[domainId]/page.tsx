"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  DkimAlgorithm,
  DkimKey,
  DnsRecord,
  Domain,
  DomainVerifyResponse,
  UpdateDomainRequest,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  PageBody,
  PageHeader,
  Section,
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
import {
  Check,
  Copy,
  Download,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api } from "@/lib/api";
import { BimiSection } from "./BimiSection";

export default function DomainDetailPage() {
  const { orgId, domainId } = useParams<{ orgId: string; domainId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const domain = useQuery({
    queryKey: ["domain", orgId, domainId],
    queryFn: () => api.get<Domain>(`/v1/orgs/${orgId}/domains/${domainId}`),
  });
  const dns = useQuery({
    queryKey: ["domain-dns", orgId, domainId],
    queryFn: () =>
      api.get<DnsRecord[]>(`/v1/orgs/${orgId}/domains/${domainId}/dns`),
  });
  const provider = useQuery({
    queryKey: ["dns-provider", orgId, domainId],
    queryFn: () =>
      api.get<{ name: string; configured: boolean }>(
        `/v1/orgs/${orgId}/domains/${domainId}/dns/provider`,
      ),
  });
  const providerLabel = provider.data?.name
    ? provider.data.name[0]!.toUpperCase() + provider.data.name.slice(1)
    : "provider";

  const publish = useMutation({
    mutationFn: () =>
      api.post<{ applied: { purpose: string; action: string }[] }>(
        `/v1/orgs/${orgId}/domains/${domainId}/dns/sync`,
        {},
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["domain-dns", orgId, domainId] });
      const errors = res.applied.filter((a) => a.action === "error").length;
      toast({
        title: errors
          ? `Published with ${errors} error${errors > 1 ? "s" : ""}`
          : `Published ${res.applied.length} records to ${providerLabel}`,
        description:
          "DNS can take a few minutes to propagate — then click Verify DNS.",
        tone: errors ? "warn" : "ok",
      });
    },
    onError: (e) =>
      toast({
        title: "Publish failed",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  const zone = useMutation({
    mutationFn: () =>
      api.get<{ filename: string; zone: string }>(
        `/v1/orgs/${orgId}/domains/${domainId}/dns/zonefile`,
      ),
    onSuccess: (res) => {
      const url = URL.createObjectURL(
        new Blob([res.zone], { type: "text/plain" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Zone file downloaded",
        description: "Import it into your DNS server, then click Recheck.",
        tone: "ok",
      });
    },
    onError: (e) =>
      toast({
        title: "Could not export zone file",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  const recheck = useMutation({
    mutationFn: () =>
      api.post<DnsRecord[]>(
        `/v1/orgs/${orgId}/domains/${domainId}/dns/check`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain-dns", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["domain", orgId, domainId] });
      toast({ title: "Records re-checked", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: "Check failed",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  const verify = useMutation({
    mutationFn: () =>
      api.post<DomainVerifyResponse>(
        `/v1/orgs/${orgId}/domains/${domainId}/verify`,
        {},
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["domain", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["domain-dns", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      toast({
        title:
          res.status === "active"
            ? "Domain verified"
            : "Verification pending — DNS not yet visible",
        description:
          res.status === "active"
            ? undefined
            : "If you run private or self-hosted DNS that isn't publicly resolvable, use Activate to mark it verified.",
        tone: res.status === "active" ? "ok" : "warn",
      });
    },
    onError: (e) =>
      toast({
        title: "Verification failed",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  // Manual activation for operators running private/self-hosted DNS that the
  // public-resolver DNS check (Verify DNS) can't reach. Until a domain is
  // active, its mailboxes fail Dovecot auth and IMAP throws — so folders 500.
  const activate = useMutation({
    mutationFn: () =>
      api.patch<Domain>(`/v1/orgs/${orgId}/domains/${domainId}`, {
        status: "active",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      toast({
        title: "Domain activated",
        description: "Mailboxes on this domain can now sign in and send mail.",
        tone: "ok",
      });
    },
    onError: (e) =>
      toast({
        title: "Could not activate domain",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/v1/orgs/${orgId}/domains/${domainId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      toast({ title: "Domain removed", tone: "ok" });
      router.replace(`/orgs/${orgId}/domains`);
    },
    onError: (e) =>
      toast({
        title: "Could not remove domain",
        description:
          e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
        tone: "bad",
      }),
  });

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link
            href={`/orgs/${orgId}/domains`}
            className="text-[var(--color-accent)] hover:underline"
          >
            ← Domains
          </Link>
        }
        title={domain.data?.name ?? "Domain"}
        description="Verify DNS, tune delivery, and manage this domain."
        actions={
          domain.data && (
            <div className="flex items-center gap-2">
              <StatusBadge status={domain.data.status} />
              {domain.data.status !== "active" && (
                <Button
                  variant="primary"
                  loading={activate.isPending}
                  leadingIcon={<ShieldCheck size={14} />}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Activate ${domain.data!.name}?`,
                        body: "Marks the domain verified without the public DNS ownership check. Use this only for a domain you control — for example self-hosted or private DNS that isn't publicly resolvable. Until a domain is active, its mailboxes can't sign in to webmail or send mail.",
                        confirmLabel: "Activate",
                      })
                    )
                      activate.mutate();
                  }}
                >
                  Activate
                </Button>
              )}
              <Button
                variant="secondary"
                loading={verify.isPending}
                onClick={() => verify.mutate()}
                leadingIcon={<RefreshCw size={14} />}
              >
                Verify DNS
              </Button>
              <Button
                variant="danger"
                leadingIcon={<Trash2 size={14} />}
                onClick={async () => {
                  if (
                    await confirm({
                      title: `Remove ${domain.data!.name}?`,
                      body: "This deletes the domain and its DNS records. Mailboxes on it will stop receiving mail.",
                      tone: "danger",
                      confirmLabel: "Remove",
                    })
                  )
                    remove.mutate();
                }}
              >
                Remove
              </Button>
            </div>
          )
        }
      />
      <PageBody>
        {domain.isLoading && <SkeletonRows count={4} />}
        {domain.data && (
          <>
            <Section
              title="DNS records"
              description={
                provider.data?.configured
                  ? `Publish these to ${providerLabel} in one click — or, if you run your own DNS (BIND, PowerDNS, Technitium…), download the zone file and import it. Then verify.`
                  : "Add these to your DNS provider or local/self-hosted DNS server. Download the zone file to import them all at once, then verify — we re-check on each verify."
              }
              actions={
                <div className="flex items-center gap-2">
                  {provider.data?.configured && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={publish.isPending}
                      onClick={() => publish.mutate()}
                      leadingIcon={<UploadCloud size={14} />}
                    >
                      Publish to {providerLabel}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={zone.isPending}
                    onClick={() => zone.mutate()}
                    leadingIcon={<Download size={14} />}
                  >
                    Zone file
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={recheck.isPending}
                    onClick={() => recheck.mutate()}
                    leadingIcon={<RefreshCw size={14} />}
                  >
                    Recheck
                  </Button>
                </div>
              }
            >
              {dns.isLoading && <SkeletonRows count={4} />}
              {dns.data && (
                <Card className="overflow-hidden">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Type</TH>
                        <TH>Name</TH>
                        <TH>Value</TH>
                        <TH>Check</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {dns.data.map((r) => (
                        <TR key={r.id}>
                          <TD>
                            <span className="mono text-xs uppercase">
                              {r.type}
                            </span>
                            {r.priority != null && (
                              <span className="ml-1 text-[10px] text-[var(--color-neutral-900)]">
                                pri {r.priority}
                              </span>
                            )}
                          </TD>
                          <TD>
                            <CopyText value={r.name} />
                          </TD>
                          <TD>
                            <CopyText value={r.content} truncate />
                          </TD>
                          <TD>
                            <StatusBadge status={r.check_status} />
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </Card>
              )}
            </Section>

            <DkimSection orgId={orgId} domainId={domainId} />

            <BimiSection orgId={orgId} domainId={domainId} />

            <SettingsForm domain={domain.data} orgId={orgId} />
          </>
        )}
      </PageBody>
    </>
  );
}

// Signing keys live in dkim_keys and only sign once *active* (the worker writes
// the private key to disk and lists the selector in rspamd's map on activate).
// Without this UI an operator has no way to create or activate a key, so
// outbound mail ships unsigned and lands in spam.
function DkimSection({ orgId, domainId }: { orgId: string; domainId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [algorithm, setAlgorithm] = useState<DkimAlgorithm>("rsa2048");

  const keys = useQuery({
    queryKey: ["dkim-keys", orgId, domainId],
    queryFn: () =>
      api.get<DkimKey[]>(`/v1/orgs/${orgId}/domains/${domainId}/dkim`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dkim-keys", orgId, domainId] });
    qc.invalidateQueries({ queryKey: ["domain-dns", orgId, domainId] });
  };
  const onError = (verb: string) => (e: unknown) =>
    toast({
      title: `Could not ${verb} key`,
      description:
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
      tone: "bad",
    });

  const generate = useMutation({
    mutationFn: () =>
      api.post(`/v1/orgs/${orgId}/domains/${domainId}/dkim`, { algorithm }),
    onSuccess: () => {
      invalidate();
      toast({
        title: "DKIM key generated",
        description:
          "Publish the DNS records, then activate the key to start signing.",
        tone: "ok",
      });
    },
    onError: onError("generate"),
  });

  const activate = useMutation({
    mutationFn: (keyId: string) =>
      api.post(
        `/v1/orgs/${orgId}/domains/${domainId}/dkim/${keyId}/activate`,
        {},
      ),
    onSuccess: () => {
      invalidate();
      toast({
        title: "Key activated — outbound mail is now signed",
        tone: "ok",
      });
    },
    onError: onError("activate"),
  });

  const retire = useMutation({
    mutationFn: (keyId: string) =>
      api.post(`/v1/orgs/${orgId}/domains/${domainId}/dkim/${keyId}/retire`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: "Key retired", tone: "ok" });
    },
    onError: onError("retire"),
  });

  return (
    <Section
      title="DKIM signing keys"
      description="Generate a key, publish its DNS record, then activate it so outbound mail is signed. Only one key signs at a time; keep the previous key published until receivers pick up the new one."
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as DkimAlgorithm)}
            className="w-auto"
          >
            <option value="rsa2048">RSA 2048</option>
            <option value="ed25519">Ed25519</option>
          </Select>
          <Button
            variant="primary"
            size="sm"
            loading={generate.isPending}
            onClick={() => generate.mutate()}
            leadingIcon={<KeyRound size={14} />}
          >
            Generate key
          </Button>
        </div>
      }
    >
      {keys.isLoading && <SkeletonRows count={2} />}
      {keys.data && keys.data.length === 0 && (
        <Card className="p-6 text-sm text-[var(--color-neutral-900)]">
          No signing key yet. Generate one, publish its DNS record, then activate
          it — until then outbound mail is unsigned and likely to be marked spam.
        </Card>
      )}
      {keys.data && keys.data.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Selector</TH>
                <TH>Algorithm</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {keys.data.map((k) => (
                <TR key={k.id}>
                  <TD>
                    <span className="mono text-xs">{k.selector}</span>
                  </TD>
                  <TD>
                    <span className="mono text-xs uppercase">
                      {k.algorithm}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={k.status} />
                  </TD>
                  <TD className="text-xs">
                    {new Date(k.created_at).toLocaleDateString()}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-3">
                      {k.status !== "active" && k.status !== "retired" && (
                        <button
                          className="text-xs text-[var(--color-accent)] hover:underline"
                          onClick={() => activate.mutate(k.id)}
                        >
                          Activate
                        </button>
                      )}
                      {k.status !== "retired" && (
                        <button
                          className="text-xs text-[var(--color-neutral-900)] hover:underline"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: `Retire selector ${k.selector}?`,
                                body: "The key stops signing mail. Retire a key only after a newer key is active and receivers have picked it up.",
                                tone: "danger",
                                confirmLabel: "Retire",
                              })
                            )
                              retire.mutate(k.id);
                          }}
                        >
                          Retire
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </Section>
  );
}

function CopyText({
  value,
  truncate,
}: {
  value: string;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="group inline-flex items-center gap-1.5 text-left max-w-full"
      title="Copy"
    >
      <span
        className={
          "mono text-xs" + (truncate ? " truncate max-w-[26rem]" : "")
        }
      >
        {value}
      </span>
      {copied ? (
        <Check size={12} className="shrink-0 text-[var(--color-ok)]" />
      ) : (
        <Copy
          size={12}
          className="shrink-0 text-[var(--color-neutral-800)] opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </button>
  );
}

function SettingsForm({ domain, orgId }: { domain: Domain; orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const f = useForm<{
    outbound_mode: Domain["outbound_mode"];
    catch_all_target: string;
    max_mailboxes: string;
    max_quota_mb: string;
    retention_days: string;
    is_primary: boolean;
  }>({
    defaultValues: {
      outbound_mode: domain.outbound_mode,
      catch_all_target: domain.catch_all_target ?? "",
      max_mailboxes: domain.max_mailboxes?.toString() ?? "",
      max_quota_mb: domain.max_quota_mb?.toString() ?? "",
      retention_days: domain.retention_days?.toString() ?? "",
      is_primary: domain.is_primary,
    },
  });

  useEffect(() => {
    f.reset({
      outbound_mode: domain.outbound_mode,
      catch_all_target: domain.catch_all_target ?? "",
      max_mailboxes: domain.max_mailboxes?.toString() ?? "",
      max_quota_mb: domain.max_quota_mb?.toString() ?? "",
      retention_days: domain.retention_days?.toString() ?? "",
      is_primary: domain.is_primary,
    });
  }, [domain, f]);

  const mut = useMutation({
    mutationFn: (body: UpdateDomainRequest) =>
      api.patch<Domain>(`/v1/orgs/${orgId}/domains/${domain.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", orgId, domain.id] });
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      toast({ title: "Domain updated", tone: "ok" });
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  const numOrNull = (v: string) =>
    v.trim() === "" ? null : Math.max(0, Number(v));

  return (
    <Section
      title="Delivery & limits"
      description="Outbound routing, catch-all, and per-domain caps."
    >
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={f.handleSubmit((v) => {
            setErr(null);
            mut.mutate({
              is_primary: v.is_primary,
              outbound_mode: v.outbound_mode,
              catch_all_target: v.catch_all_target.trim() || null,
              max_mailboxes: numOrNull(v.max_mailboxes),
              max_quota_mb: numOrNull(v.max_quota_mb),
              retention_days:
                v.retention_days.trim() === ""
                  ? null
                  : Math.max(1, Number(v.retention_days)),
            });
          })}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Outbound mode">
              <Select {...f.register("outbound_mode")}>
                <option value="inherit">Inherit org default</option>
                <option value="direct">Direct</option>
                <option value="smarthost">Smarthost</option>
              </Select>
            </FormField>
            <FormField
              label="Catch-all target"
              hint="Deliver unmatched addresses here. Leave blank to bounce."
            >
              <Input
                type="email"
                placeholder="catchall@example.com"
                {...f.register("catch_all_target")}
              />
            </FormField>
            <FormField label="Max mailboxes" hint="Blank = unlimited">
              <Input
                type="number"
                min={0}
                placeholder="unlimited"
                {...f.register("max_mailboxes")}
              />
            </FormField>
            <FormField label="Max quota per mailbox (MB)" hint="Blank = unlimited">
              <Input
                type="number"
                min={0}
                placeholder="unlimited"
                {...f.register("max_quota_mb")}
              />
            </FormField>
            <FormField label="Retention (days)" hint="Blank = keep forever">
              <Input
                type="number"
                min={1}
                placeholder="forever"
                {...f.register("retention_days")}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
            <Checkbox {...f.register("is_primary")} />
            Primary domain for outbound
          </label>
          {err && (
            <p className="text-xs text-[var(--color-bad)]" role="alert">
              {err}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={mut.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </Section>
  );
}
