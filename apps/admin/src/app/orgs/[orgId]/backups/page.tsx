"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
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
  Modal,
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

const CONFIRM = "RESTORE";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

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
          frequency: schedule.data.frequency,
          retention_days: schedule.data.retention_days,
          enabled: schedule.data.enabled,
        }
      : undefined,
  });
  const [err, setErr] = useState<string | null>(null);
  const errFrom = (e: unknown) =>
    e instanceof ApiError
      ? e.problem.detail ?? e.problem.title
      : (e as Error).message;

  const mut = useMutation({
    mutationFn: (body: UpdateBackupScheduleRequest) =>
      api.put(`/v1/orgs/${orgId}/backups/schedule`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-schedule", orgId] });
      toast({ title: "Schedule saved", tone: "ok" });
    },
    onError: (e) => setErr(errFrom(e)),
  });

  const runNow = useMutation({
    mutationFn: () => api.post(`/v1/orgs/${orgId}/backups/run`, { kind: "full" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-runs", orgId] });
      qc.invalidateQueries({ queryKey: ["backup-schedule", orgId] });
      toast({ title: "Backup completed", tone: "ok" });
    },
    onError: (e) =>
      toast({ title: "Backup failed", description: errFrom(e), tone: "bad" }),
  });

  const [restoreTarget, setRestoreTarget] = useState<BackupRun | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const restore = useMutation({
    mutationFn: (id: string) =>
      api.post(`/v1/orgs/${orgId}/backups/${id}/restore`, {}),
    onSuccess: () => {
      setRestoreTarget(null);
      setConfirmText("");
      toast({ title: "Database restored", tone: "ok" });
    },
    onError: (e) =>
      toast({ title: "Restore failed", description: errFrom(e), tone: "bad" }),
  });

  return (
    <>
      <PageHeader
        title="Backups"
        description="Scheduled pg_dump of the platform database, stored in the configured object storage with an integrity checksum."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Play size={14} />}
            loading={runNow.isPending}
            onClick={() => runNow.mutate()}
          >
            Back up now
          </Button>
        }
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
              <FormField label="Frequency">
                <select
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-field)] px-2.5 py-1.5 text-sm"
                  {...f.register("frequency")}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
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
              <div className="md:col-span-2 flex items-end text-xs text-[var(--color-neutral-900)]">
                Last run {fmtDate(schedule.data?.last_run_at ?? null)} · Next run{" "}
                {schedule.data?.enabled
                  ? fmtDate(schedule.data?.next_run_at ?? null)
                  : "paused"}
              </div>
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
                No runs yet — trigger one with “Back up now” or wait for the next
                scheduled run.
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
                    <TH> </TH>
                  </TR>
                </THead>
                <tbody>
                  {runs.data.map((r) => (
                    <TR key={r.id}>
                      <TD>{r.kind}</TD>
                      <TD>
                        <span title={r.error ?? undefined}>
                          <StatusBadge status={r.status} />
                        </span>
                      </TD>
                      <TD>
                        <span className="mono text-xs">
                          {r.size_bytes
                            ? `${(r.size_bytes / 1024 ** 2).toFixed(1)} MB`
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
                      <TD>
                        {r.status === "completed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leadingIcon={<RotateCcw size={13} />}
                            onClick={() => {
                              setConfirmText("");
                              setRestoreTarget(r);
                            }}
                          >
                            Restore
                          </Button>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageBody>

      <Modal
        open={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title="Restore database"
        description="This overwrites the live platform database with the selected backup. Data written since the backup was taken will be lost. This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={restore.isPending}
              disabled={confirmText !== CONFIRM}
              onClick={() => restoreTarget && restore.mutate(restoreTarget.id)}
            >
              Restore
            </Button>
          </>
        }
      >
        <FormField label={`Type ${CONFIRM} to confirm`}>
          <Input
            monospace
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM}
          />
        </FormField>
      </Modal>
    </>
  );
}
