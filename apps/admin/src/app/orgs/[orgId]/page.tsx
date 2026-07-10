"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { DashboardOverview, SecurityScore } from "@justmail/contracts";
import { fmtBytes, fmtMb } from "@justmail/shared-utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ErrorState,
  PageBody,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";

export default function Overview() {
  const { orgId } = useParams<{ orgId: string }>();
  const overview = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => api.get<DashboardOverview>(`/v1/orgs/${orgId}/dashboard`),
  });
  const score = useQuery({
    queryKey: ["security-score", orgId],
    queryFn: () =>
      api.get<SecurityScore>(`/v1/orgs/${orgId}/security/score`),
  });

  if (overview.isError) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageBody>
          <ErrorState onRetry={() => overview.refetch()} />
        </PageBody>
      </>
    );
  }

  const d = overview.data;
  return (
    <>
      <PageHeader
        title="Overview"
        description="Live status of your mail platform."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Domains"
            value={d?.domains.active}
            hint={d ? `${d.domains.total} total` : undefined}
            loading={!d}
          />
          <StatCard
            label="Mailboxes"
            value={d?.mailboxes.active}
            hint={
              d
                ? `${d.mailboxes.total} total · ${d.mailboxes.suspended} suspended`
                : undefined
            }
            loading={!d}
          />
          <StatCard
            label="Storage used"
            value={d ? fmtBytes(d.quota.used_bytes) : undefined}
            hint={d ? `of ${fmtMb(d.quota.allocated_mb)}` : undefined}
            loading={!d}
          />
          <StatCard
            label="Security score"
            value={score.data ? `${score.data.score}/100` : undefined}
            loading={!score.data}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Mail (24h)</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Line label="Inbound" value={d?.events_24h.inbound} />
                <Line label="Outbound" value={d?.events_24h.outbound} />
                <Line label="Rejected" value={d?.events_24h.rejected} tone="warn" />
                <Line label="Deferred" value={d?.events_24h.deferred} tone="warn" />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Postfix queue</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Line label="Active" value={d?.queue.active} />
                <Line label="Deferred" value={d?.queue.deferred} tone="warn" />
                <Line label="Hold" value={d?.queue.hold} tone="bad" />
                <Line
                  label="Oldest"
                  value={
                    d?.queue.oldest_age_s
                      ? `${Math.round(d.queue.oldest_age_s / 60)}m`
                      : "—"
                  }
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {score.data && (
          <Card>
            <CardHeader>
              <CardTitle>Deliverability factors</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {score.data.factors.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{f.label}</span>
                    <StatusBadge status={f.ok ? "ok" : "pending"} />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-neutral-800)]">
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-2" />
      ) : (
        <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] tabular-nums leading-none">
          {value ?? "—"}
        </div>
      )}
      {hint && (
        <div className="mt-2 text-xs text-[var(--color-neutral-900)]">
          {hint}
        </div>
      )}
    </Card>
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
      <span className="text-[var(--color-neutral-900)]">{label}</span>
      <span
        className={
          "font-mono " +
          (tone === "warn"
            ? "text-[var(--color-warn)]"
            : tone === "bad"
              ? "text-[var(--color-bad)]"
              : "")
        }
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
