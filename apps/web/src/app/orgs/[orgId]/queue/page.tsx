"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/api";
import { PageBody, PageHeader, Stat } from "../../../../components/shell";

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
    queryKey: ["queue", orgId, "deferred"],
    queryFn: () => api.get<Deferred[]>(`/v1/orgs/${orgId}/queue/deferred`),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Queue"
        description="Postfix queue snapshot plus recent deferred deliveries."
      />
      <PageBody>
        {snap.data && (
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Active" value={snap.data.active} />
            <Stat label="Deferred" value={snap.data.deferred} />
            <Stat label="Hold" value={snap.data.hold} />
            <Stat
              label="Oldest"
              value={
                snap.data.oldest_age_s
                  ? `${Math.round(snap.data.oldest_age_s / 60)}m`
                  : "—"
              }
              hint={
                snap.data.taken_at
                  ? `Snapshot ${new Date(snap.data.taken_at).toLocaleTimeString()}`
                  : "No snapshot yet"
              }
            />
          </div>
        )}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 text-sm font-medium">
            Recent deferred (24h)
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Queue ID</th>
                <th>From</th>
                <th>To</th>
                <th>DSN</th>
                <th>Attempts</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {deferred.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-sm text-[var(--color-ink-300)]">
                    Nothing deferred in the last 24 hours.
                  </td>
                </tr>
              )}
              {deferred.data?.map((d) => (
                <tr key={d.queue_id}>
                  <td className="mono">{d.queue_id}</td>
                  <td className="mono text-xs">{d.from_addr ?? "—"}</td>
                  <td className="mono text-xs">{d.to_addr ?? "—"}</td>
                  <td className="mono text-xs">{d.dsn ?? "—"}</td>
                  <td>{d.attempts}</td>
                  <td className="text-xs text-[var(--color-ink-300)]">
                    {new Date(d.last_seen).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
