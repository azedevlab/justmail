"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { DashboardOverview } from "@justmail/types";
import { api } from "../../../lib/api";
import { PageBody, PageHeader, Stat } from "../../../components/shell";

export default function Overview() {
  const { orgId } = useParams<{ orgId: string }>();
  const overview = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => api.get<DashboardOverview>(`/v1/orgs/${orgId}/dashboard`),
  });
  const score = useQuery({
    queryKey: ["score", orgId],
    queryFn: () =>
      api.get<{ score: number; factors: Array<{ id: string; label: string; ok: boolean; weight: number }> }>(
        `/v1/orgs/${orgId}/security/score`,
      ),
  });

  const d = overview.data;
  return (
    <>
      <PageHeader
        title="Overview"
        description="Live status of your mail platform"
      />
      <PageBody>
        {overview.isLoading && (
          <div className="text-sm text-[var(--color-ink-300)]">Loading…</div>
        )}
        {d && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat
                label="Domains"
                value={d.domains.active}
                hint={`${d.domains.total} total`}
              />
              <Stat
                label="Mailboxes"
                value={d.mailboxes.active}
                hint={`${d.mailboxes.total} total · ${d.mailboxes.suspended} suspended`}
              />
              <Stat
                label="Storage"
                value={fmtBytes(d.quota.used_bytes)}
                hint={`of ${fmtMb(d.quota.allocated_mb)} allocated`}
              />
              <Stat
                label="Security score"
                value={score.data ? `${score.data.score}/100` : "…"}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="text-sm font-medium mb-3">Mail (24h)</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Line label="Inbound" value={d.events_24h.inbound} />
                  <Line label="Outbound" value={d.events_24h.outbound} />
                  <Line label="Rejected" value={d.events_24h.rejected} tone="warn" />
                  <Line label="Deferred" value={d.events_24h.deferred} tone="warn" />
                </div>
              </div>
              <div className="card p-5">
                <div className="text-sm font-medium mb-3">Postfix queue</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Line label="Active" value={d.queue.active} />
                  <Line label="Deferred" value={d.queue.deferred} tone="warn" />
                  <Line label="Hold" value={d.queue.hold} tone="bad" />
                  <Line
                    label="Oldest"
                    value={
                      d.queue.oldest_age_s
                        ? `${Math.round(d.queue.oldest_age_s / 60)}m`
                        : "—"
                    }
                  />
                </div>
              </div>
            </div>

            {score.data && score.data.factors.length > 0 && (
              <div className="card p-5">
                <div className="text-sm font-medium mb-3">Deliverability factors</div>
                <div className="space-y-2">
                  {score.data.factors.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{f.label}</span>
                      <span className={"badge " + (f.ok ? "badge-ok" : "badge-warn")}>
                        {f.ok ? "OK" : "Missing"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-300)]">{label}</span>
      <span
        className={
          "font-mono " +
          (tone === "warn"
            ? "text-[var(--color-warn-500)]"
            : tone === "bad"
            ? "text-[var(--color-bad-500)]"
            : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function fmtMb(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
