"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  BackupRun,
  BackupSchedule,
  UpdateBackupScheduleRequest,
} from "@justmail/types";
import { api, ApiError } from "../../../../lib/api";
import { PageBody, PageHeader, StatusBadge } from "../../../../components/shell";

export default function BackupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const schedule = useQuery({
    queryKey: ["backup-schedule", orgId],
    queryFn: () => api.get<BackupSchedule>(`/v1/orgs/${orgId}/backups/schedule`),
  });
  const runs = useQuery({
    queryKey: ["backup-runs", orgId],
    queryFn: () => api.get<BackupRun[]>(`/v1/orgs/${orgId}/backups`),
  });

  const f = useForm<UpdateBackupScheduleRequest>({
    values: schedule.data
      ? {
          destination: schedule.data.destination,
          retention_days: schedule.data.retention_days,
          enabled: schedule.data.enabled,
        }
      : undefined,
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: UpdateBackupScheduleRequest) =>
      api.put(`/v1/orgs/${orgId}/backups/schedule`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backup-schedule", orgId] }),
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });

  return (
    <>
      <PageHeader
        title="Backups"
        description="Nightly systemd timer runs pg_dump + maildir → configured destination (S3-compatible URI or local path)."
      />
      <PageBody>
        <div className="card p-5">
          <div className="text-sm font-medium mb-3">Schedule</div>
          <form
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            onSubmit={f.handleSubmit((v) => {
              setErr(null);
              mut.mutate(v);
            })}
          >
            <label className="block md:col-span-3">
              <span className="label">Destination (s3://…, minio://…, or empty for local)</span>
              <input
                className="input mono"
                placeholder="s3://backups-devlab/justmail/"
                {...f.register("destination")}
              />
            </label>
            <label className="block">
              <span className="label">Retention (days)</span>
              <input
                className="input mono"
                type="number"
                min={1}
                {...f.register("retention_days", { valueAsNumber: true, min: 1 })}
              />
            </label>
            <label className="flex items-center gap-2 self-end">
              <input type="checkbox" {...f.register("enabled")} /> Enabled
            </label>
            <div className="flex items-end justify-end md:col-span-1">
              <button className="btn btn-primary" disabled={mut.isPending}>
                {mut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {err && (
              <p className="text-xs text-[var(--color-bad-500)] md:col-span-3">
                {err}
              </p>
            )}
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-white/5 text-sm font-medium">
            Recent runs
          </div>
          {runs.data && runs.data.length === 0 ? (
            <div className="p-6 text-sm text-[var(--color-ink-300)]">
              No runs yet — the first will complete after the next systemd timer tick.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {runs.data?.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kind}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="mono text-xs">
                      {r.size_bytes
                        ? `${(r.size_bytes / 1024 ** 3).toFixed(2)} GB`
                        : "—"}
                    </td>
                    <td className="text-xs">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td className="text-xs">
                      {r.finished_at
                        ? new Date(r.finished_at).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="mono text-xs">{r.destination}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageBody>
    </>
  );
}
