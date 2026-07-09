"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Domain, DnsRecord } from "@justmail/types";
import { api, ApiError } from "../../../../../lib/api";
import { PageBody, PageHeader, StatusBadge } from "../../../../../components/shell";

interface DkimKey {
  id: string;
  selector: string;
  algorithm: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  domain_name: string;
}

export default function DomainDetail() {
  const { orgId, domainId } = useParams<{ orgId: string; domainId: string }>();
  const qc = useQueryClient();

  const domain = useQuery({
    queryKey: ["domain", orgId, domainId],
    queryFn: () => api.get<Domain>(`/v1/orgs/${orgId}/domains/${domainId}`),
  });
  const dns = useQuery({
    queryKey: ["dns", orgId, domainId],
    queryFn: () => api.get<DnsRecord[]>(`/v1/orgs/${orgId}/domains/${domainId}/dns`),
  });
  const dkim = useQuery({
    queryKey: ["dkim", orgId, domainId],
    queryFn: () =>
      api.get<DkimKey[]>(`/v1/orgs/${orgId}/domains/${domainId}/dkim`),
  });

  const verify = useMutation({
    mutationFn: () => api.post(`/v1/orgs/${orgId}/domains/${domainId}/verify`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domain", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["dns", orgId, domainId] });
    },
  });
  const check = useMutation({
    mutationFn: () => api.post(`/v1/orgs/${orgId}/domains/${domainId}/dns/check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", orgId, domainId] }),
  });
  const sync = useMutation({
    mutationFn: () => api.post(`/v1/orgs/${orgId}/domains/${domainId}/dns/sync`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dns", orgId, domainId] }),
  });
  const generateDkim = useMutation({
    mutationFn: () =>
      api.post(`/v1/orgs/${orgId}/domains/${domainId}/dkim`, { algorithm: "rsa2048" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dkim", orgId, domainId] });
      qc.invalidateQueries({ queryKey: ["dns", orgId, domainId] });
    },
  });
  const activateDkim = useMutation({
    mutationFn: (keyId: string) =>
      api.post(`/v1/orgs/${orgId}/domains/${domainId}/dkim/${keyId}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dkim", orgId, domainId] }),
  });

  if (!domain.data) return <PageHeader title="Loading…" />;
  const d = domain.data;

  return (
    <>
      <PageHeader
        title={d.name}
        description={
          <>
            <StatusBadge status={d.status} />{" "}
            {d.is_primary && (
              <span className="badge badge-muted ml-1">primary</span>
            )}
            <Link
              href={`/orgs/${orgId}/domains`}
              className="ml-3 text-xs text-[var(--color-brand-400)] hover:underline"
            >
              ← All domains
            </Link>
          </>
        }
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => check.mutate()}
              disabled={check.isPending}
            >
              {check.isPending ? "Checking…" : "Check DNS"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              title="One-click repair: upsert expected records into Cloudflare"
            >
              {sync.isPending ? "Syncing…" : "Sync to Cloudflare"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => verify.mutate()}
              disabled={verify.isPending}
            >
              {verify.isPending ? "Verifying…" : "Verify"}
            </button>
          </>
        }
      />
      <PageBody>
        {(sync.error || verify.error) && (
          <p className="text-xs text-[var(--color-bad-500)]">
            {(sync.error as ApiError | undefined)?.problem.title ??
              (verify.error as ApiError | undefined)?.problem.title}
          </p>
        )}

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="text-sm font-medium">Expected DNS records</div>
            <div className="text-xs text-[var(--color-ink-400)]">
              Verification token{" "}
              <span className="mono">{d.verification_token}</span>
            </div>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Type</th>
                <th>Name</th>
                <th>Content</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dns.data?.map((r) => (
                <tr key={r.id}>
                  <td className="capitalize">{r.purpose.replace(/_/g, " ")}</td>
                  <td className="mono">{r.type}</td>
                  <td className="mono text-xs">{r.name}</td>
                  <td className="mono text-xs max-w-xs truncate" title={r.content}>
                    {r.content}
                  </td>
                  <td>
                    <StatusBadge status={r.check_status} />
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5} className="text-sm text-[var(--color-ink-300)]">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="text-sm font-medium">DKIM keys</div>
            <button
              className="btn btn-secondary"
              onClick={() => generateDkim.mutate()}
              disabled={generateDkim.isPending}
            >
              {generateDkim.isPending ? "Generating…" : "+ Generate new key"}
            </button>
          </div>
          {dkim.data && dkim.data.length === 0 ? (
            <div className="p-6 text-sm text-[var(--color-ink-300)]">
              No DKIM keys yet. Generate one to enable message signing.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Selector</th>
                  <th>Algorithm</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dkim.data?.map((k) => (
                  <tr key={k.id}>
                    <td className="mono">{k.selector}</td>
                    <td>{k.algorithm}</td>
                    <td>
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {new Date(k.created_at).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {k.status !== "active" && k.status !== "retired" && (
                        <button
                          className="btn btn-secondary text-xs"
                          onClick={() => activateDkim.mutate(k.id)}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </PageBody>
    </>
  );
}
