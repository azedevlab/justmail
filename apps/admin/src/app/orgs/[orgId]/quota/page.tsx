"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { OrgQuota } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
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
  useToast,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";

function formatMb(mb: number): string {
  if (mb >= 1_048_576) return `${(mb / 1_048_576).toFixed(1)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(1)} MB`;
}

export default function QuotaPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState("");

  const quota = useQuery({
    queryKey: ["quota", orgId],
    queryFn: () => api.get<OrgQuota>(`/v1/orgs/${orgId}/quota`),
  });

  useEffect(() => {
    if (quota.data) {
      setValue(
        quota.data.storage_quota_mb === null
          ? ""
          : String(quota.data.storage_quota_mb),
      );
    }
  }, [quota.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/v1/orgs/${orgId}/quota`, {
        storage_quota_mb: value.trim() === "" ? null : Number(value),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quota", orgId] });
      toast({ title: "Storage quota saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.problem.title : (e as Error).message,
        tone: "bad",
      }),
  });

  const d = quota.data;
  const cap = d?.storage_quota_mb ?? null;
  const pct =
    cap && cap > 0 ? Math.min(100, Math.round((d!.allocated_mb / cap) * 100)) : 0;
  const over = cap !== null && d !== undefined && d.allocated_mb > cap;

  return (
    <>
      <PageHeader
        title="Storage"
        description="Set an allocation ceiling for the org. New and resized mailboxes cannot push the total allocated capacity past this cap. Dovecot enforces each mailbox's own quota at the protocol layer."
      />
      <PageBody>
        {quota.isLoading && <SkeletonRows count={2} />}
        {d && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Allocation</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-neutral-900)]">
                    Ceiling:
                  </span>
                  {cap === null ? (
                    <Badge tone="neutral">Unlimited</Badge>
                  ) : (
                    <Badge tone={over ? "bad" : "ok"}>{formatMb(cap)}</Badge>
                  )}
                </div>
                {cap !== null && (
                  <div>
                    <div className="h-2 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: over
                            ? "var(--color-bad)"
                            : "var(--color-accent)",
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--color-neutral-700)]">
                      {formatMb(d.allocated_mb)} allocated of {formatMb(cap)} (
                      {pct}%)
                    </p>
                  </div>
                )}
                <dl className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-800)]">
                      Allocated
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {formatMb(d.allocated_mb)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-800)]">
                      Actually used
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {formatBytes(d.used_bytes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-800)]">
                      Mailboxes
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {d.mailbox_count}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Set ceiling</CardTitle>
              </CardHeader>
              <CardBody>
                <form
                  className="flex flex-wrap items-end gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate();
                  }}
                >
                  <FormField label="Storage quota (MB)">
                    <Input
                      type="number"
                      min={0}
                      placeholder="unlimited"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={save.isPending}
                  >
                    Save
                  </Button>
                </form>
                <p className="mt-3 text-xs text-[var(--color-neutral-700)]">
                  Leave blank for unlimited. You cannot set a ceiling below the{" "}
                  {formatMb(d.allocated_mb)} already allocated.
                </p>
              </CardBody>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}
