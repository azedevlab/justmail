"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type {
  BackupRun,
  BackupSchedule,
  UpdateBackupScheduleRequest,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PageBody,
  PageHeader,
  SkeletonRows,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";

export default function BackupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const schedule = useQuery({
    queryKey: ["backup-schedule", orgId],
    queryFn: () =>
      api.get<BackupSchedule>(`/v1/orgs/${orgId}/backups/schedule`),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-schedule", orgId] });
      toast({ title: "Schedule saved", tone: "ok" });
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  return (
    <>
      <PageHeader
        title="Backups"
        description="pg_dump + maildir + attachments run by the nightly systemd timer."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardBody>
            <form
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
              onSubmit={f.handleSubmit((v) => {
                setErr(null);
                mut.mutate(v);
              })}
            >
              <FormField label="Destination" className="md:col-span-3">
                <Input
                  monospace
                  placeholder="s3://backups-prod/justmail/ (blank for local FS)"
                  {...f.register("destination")}
                />
              </FormField>
              <FormField label="Retention days">
                <Input
                  type="number"
                  monospace
                  min={1}
                  {...f.register("retention_days", {
                    valueAsNumber: true,
                    min: 1,
                  })}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm self-end">
                <input type="checkbox" {...f.register("enabled")} /> Enabled
              </label>
              <div className="flex items-end justify-end">
                <Button variant="primary" type="submit" loading={mut.isPending}>
                  Save schedule
                </Button>
              </div>
              {err && (
                <p className="md:col-span-3 text-xs text-[var(--color-bad)]" role="alert">
                  {err}
                </p>
              )}
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardBody>
            {runs.isLoading && <SkeletonRows count={3} />}
            {runs.data && runs.data.length === 0 && (
              <p className="text-sm text-[var(--color-neutral-900)]">
                No runs yet — the first will complete after the next timer tick.
              </p>
            )}
            {runs.data && runs.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>Kind</TH>
                    <TH>Status</TH>
                    <TH>Size</TH>
                    <TH>Started</TH>
                    <TH>Finished</TH>
                    <TH>Destination</TH>
                  </TR>
                </THead>
                <tbody>
                  {runs.data.map((r) => (
                    <TR key={r.id}>
                      <TD>{r.kind}</TD>
                      <TD>
                        <StatusBadge status={r.status} />
                      </TD>
                      <TD>
                        <span className="mono text-xs">
                          {r.size_bytes
                            ? `${(r.size_bytes / 1024 ** 3).toFixed(2)} GB`
                            : "—"}
                        </span>
                      </TD>
                      <TD className="text-xs">
                        {new Date(r.started_at).toLocaleString()}
                      </TD>
                      <TD className="text-xs">
                        {r.finished_at
                          ? new Date(r.finished_at).toLocaleTimeString()
                          : "—"}
                      </TD>
                      <TD>
                        <span className="mono text-xs">{r.destination}</span>
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
