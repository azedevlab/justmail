"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageBody,
  PageHeader,
  SkeletonRows,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";

interface Snapshot {
  active: number;
  deferred: number;
  hold: number;
  oldest_age_s: number;
  taken_at: string | null;
}
interface Deferred {
  queue_id: string;
  from_addr: string | null;
  to_addr: string | null;
  dsn: string | null;
  last_seen: string;
  attempts: number;
}

export default function QueuePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const snap = useQuery({
    queryKey: ["queue", orgId],
    queryFn: () => api.get<Snapshot>(`/v1/orgs/${orgId}/queue`),
    refetchInterval: 15_000,
  });
  const deferred = useQuery({
    queryKey: ["queue-deferred", orgId],
    queryFn: () =>
      api.get<Deferred[]>(`/v1/orgs/${orgId}/queue/deferred?limit=100`),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Queue"
        description="Live postfix queue snapshot and recent deferred deliveries."
      />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <QueueStat label="Active" value={snap.data?.active} />
          <QueueStat label="Deferred" value={snap.data?.deferred} tone="warn" />
          <QueueStat label="Hold" value={snap.data?.hold} tone="bad" />
          <QueueStat
            label="Oldest"
            value={
              snap.data?.oldest_age_s
                ? `${Math.round(snap.data.oldest_age_s / 60)}m`
                : "—"
            }
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent deferred (24h)</CardTitle>
          </CardHeader>
          <CardBody>
            {deferred.isLoading && <SkeletonRows count={3} />}
            {deferred.data && deferred.data.length === 0 && (
              <p className="text-sm text-[var(--color-neutral-900)]">
                Nothing deferred.
              </p>
            )}
            {deferred.data && deferred.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
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
                    <TR key={d.queue_id}>
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
                      <TD className="text-xs">
                        {new Date(d.last_seen).toLocaleString()}
                      </TD>
                    </TR>
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

function QueueStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn" | "bad";
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[11px] font-medium text-[var(--color-neutral-900)]">
          {label}
        </div>
        <div
          className={
            "mt-2 text-2xl font-semibold font-mono " +
            (tone === "warn"
              ? "text-[var(--color-warn)]"
              : tone === "bad"
                ? "text-[var(--color-bad)]"
                : "")
          }
        >
          {value ?? "—"}
        </div>
      </CardBody>
    </Card>
  );
}
