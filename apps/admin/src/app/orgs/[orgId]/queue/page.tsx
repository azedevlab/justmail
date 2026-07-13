"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  DeferredEntry,
  QueueSnapshot,
  TraceStep,
} from "@justmail/contracts";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
  ErrorState,
  PageBody,
  PageHeader,
  Skeleton,
  SkeletonRows,
  Stat,
  type StatTone,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@justmail/shared-ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

export default function QueuePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const snap = useQuery({
    queryKey: ["queue", orgId],
    queryFn: () => api.get<QueueSnapshot>(`/v1/orgs/${orgId}/queue`),
    refetchInterval: 15_000,
  });
  const deferred = useQuery({
    queryKey: ["queue-deferred", orgId],
    queryFn: () =>
      api.get<DeferredEntry[]>(`/v1/orgs/${orgId}/queue/deferred?limit=100`),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Queue"
        description="Live postfix queue snapshot and recent deferred deliveries."
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QueueStat label="Active" value={snap.data?.active} loading={!snap.data} />
          <QueueStat
            label="Deferred"
            value={snap.data?.deferred}
            tone="warn"
            loading={!snap.data}
          />
          <QueueStat
            label="Hold"
            value={snap.data?.hold}
            tone="bad"
            loading={!snap.data}
          />
          <QueueStat
            label="Oldest"
            value={
              snap.data?.oldest_age_s
                ? `${Math.round(snap.data.oldest_age_s / 60)}m`
                : "—"
            }
            loading={!snap.data}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent deferred (24h)</CardTitle>
          </CardHeader>
          <CardBody>
            {deferred.isLoading && <SkeletonRows count={3} />}
            {deferred.isError && (
              <ErrorState onRetry={() => deferred.refetch()} />
            )}
            {deferred.data && deferred.data.length === 0 && (
              <Empty
                title="Nothing deferred"
                description="All recent deliveries went out on the first attempt."
              />
            )}
            {deferred.data && deferred.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH></TH>
                    <TH>Queue ID</TH>
                    <TH>From</TH>
                    <TH>To</TH>
                    <TH>DSN</TH>
                    <TH>Attempts</TH>
                    <TH>Last seen</TH>
                  </TR>
                </THead>
                <tbody>
                  {deferred.data.map((d) => (
                    <DeferredRow key={d.queue_id} orgId={orgId} entry={d} />
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

function DeferredRow({
  orgId,
  entry: d,
}: {
  orgId: string;
  entry: DeferredEntry;
}) {
  const [open, setOpen] = useState(false);
  const trace = useQuery({
    queryKey: ["queue-trace", orgId, d.queue_id],
    queryFn: () =>
      api.get<TraceStep[]>(
        `/v1/orgs/${orgId}/queue/trace/${encodeURIComponent(d.queue_id)}`,
      ),
    enabled: open,
  });

  return (
    <>
      <TR className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TD className="w-6 text-[var(--color-neutral-800)]">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </TD>
        <TD>
          <span className="mono">{d.queue_id}</span>
        </TD>
        <TD>
          <span className="mono text-xs">{d.from_addr ?? "—"}</span>
        </TD>
        <TD>
          <span className="mono text-xs">{d.to_addr ?? "—"}</span>
        </TD>
        <TD>
          <span className="mono text-xs">{d.dsn ?? "—"}</span>
        </TD>
        <TD>{d.attempts}</TD>
        <TD className="text-xs">{new Date(d.last_seen).toLocaleString()}</TD>
      </TR>
      {open && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-[var(--color-surface-2)] px-4 py-3">
              {trace.isLoading && <SkeletonRows count={2} />}
              {trace.isError && (
                <p className="text-xs text-[var(--color-bad)]" role="alert">
                  Couldn’t load the delivery trace for this queue id.
                </p>
              )}
              {trace.data && trace.data.length === 0 && (
                <p className="text-xs text-[var(--color-neutral-800)]">
                  No recorded events for this queue id.
                </p>
              )}
              {trace.data && trace.data.length > 0 && (
                <Table>
                  <THead>
                    <TR>
                      <TH>Event</TH>
                      <TH>Relay</TH>
                      <TH>DSN</TH>
                      <TH>TLS</TH>
                      <TH>Detail</TH>
                      <TH>When</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {trace.data.map((s, i) => (
                      <TR key={`${s.event}-${i}`}>
                        <TD>
                          <Badge
                            tone={
                              s.event.includes("bounce")
                                ? "bad"
                                : s.event.includes("defer")
                                  ? "warn"
                                  : s.event.includes("sent")
                                    ? "ok"
                                    : "muted"
                            }
                          >
                            {s.event}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="mono text-xs">{s.relay ?? "—"}</span>
                        </TD>
                        <TD>
                          <span className="mono text-xs">{s.dsn ?? "—"}</span>
                        </TD>
                        <TD>
                          <span className="mono text-xs">
                            {s.tls_version ?? "—"}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-xs">{s.detail ?? "—"}</span>
                        </TD>
                        <TD className="text-xs">
                          {new Date(s.occurred_at).toLocaleString()}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function QueueStat({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  tone?: StatTone;
  loading?: boolean;
}) {
  return (
    <Stat
      label={label}
      tone={tone}
      value={loading ? <Skeleton className="h-6 w-14" /> : (value ?? "—")}
    />
  );
}
