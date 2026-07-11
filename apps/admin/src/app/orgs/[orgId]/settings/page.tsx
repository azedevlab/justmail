"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SettingRow } from "@justmail/contracts";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
  FormField,
  Input,
  PageBody,
  PageHeader,
  SkeletonRows,
  useToast,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";

const ATTACHMENT_LIMITS_KEY = (orgId: string) => `org:${orgId}.attachments`;

export default function SettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const list = useQuery({
    queryKey: ["settings", orgId],
    queryFn: () => api.get<SettingRow[]>(`/v1/orgs/${orgId}/settings`),
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Preferences for this organization. Values are stored in the database, not in config files."
      />
      <PageBody>
        <AttachmentLimitsCard orgId={orgId} rows={list.data} />
        <AdvancedSettingsCard
          orgId={orgId}
          rows={list.data}
          loading={list.isLoading}
        />
      </PageBody>
    </>
  );
}

// Turn a namespaced settings key into a readable label, dropping the
// `org:{orgId}.` prefix: `security.country_block` → "Security · Country block".
function humanizeKey(key: string, orgId: string): string {
  const prefix = `org:${orgId}.`;
  const suffix = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return suffix
    .split(".")
    .map((seg) =>
      seg
        .split(/[_-]/)
        .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
        .join(" "),
    )
    .join(" · ");
}

function AdvancedSettingsCard({
  orgId,
  rows,
  loading,
}: {
  orgId: string;
  rows: SettingRow[] | undefined;
  loading: boolean;
}) {
  const items = (rows ?? []).filter(
    (r) => r.key !== ATTACHMENT_LIMITS_KEY(orgId),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-xs text-[var(--color-neutral-700)]">
          Low-level values other modules store for this organization. Most have a
          dedicated page — this is a read-only reference.
        </p>
        {loading && <SkeletonRows count={2} />}
        {!loading && items.length === 0 && (
          <Empty
            title="Nothing stored yet"
            description="Modules record values here as you configure them."
          />
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-[var(--color-neutral-200)]">
            {items.map((r) => (
              <li
                key={r.key}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-neutral-1100)]">
                    {humanizeKey(r.key, orgId)}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-neutral-600)]">
                    Updated {new Date(r.updated_at).toLocaleString()}
                  </div>
                </div>
                <code className="mono max-w-[55%] truncate rounded-md bg-[var(--color-neutral-100)] px-2 py-1 text-xs text-[var(--color-neutral-900)]">
                  {JSON.stringify(r.value)}
                </code>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function AttachmentLimitsCard({
  orgId,
  rows,
}: {
  orgId: string;
  rows: SettingRow[] | undefined;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const stored = rows?.find((r) => r.key === ATTACHMENT_LIMITS_KEY(orgId))
    ?.value as { max_total_bytes?: number; max_count?: number } | undefined;

  const [maxMb, setMaxMb] = useState("");
  const [maxCount, setMaxCount] = useState("");

  // Seed inputs once the stored value loads (blank = inherit deploy defaults).
  useEffect(() => {
    if (stored?.max_total_bytes)
      setMaxMb(String(Math.round(stored.max_total_bytes / 1_000_000)));
    if (stored?.max_count) setMaxCount(String(stored.max_count));
  }, [stored?.max_total_bytes, stored?.max_count]);

  const save = useMutation({
    mutationFn: () =>
      api.put(
        `/v1/orgs/${orgId}/settings/${encodeURIComponent(ATTACHMENT_LIMITS_KEY(orgId))}`,
        {
          value: {
            max_total_bytes: maxMb ? Number(maxMb) * 1_000_000 : undefined,
            max_count: maxCount ? Number(maxCount) : undefined,
          },
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", orgId] });
      toast({ title: "Attachment limits saved", tone: "ok" });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachment limits</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-wrap items-end gap-4">
          <FormField label="Max total size (MB)">
            <Input
              type="number"
              min={1}
              placeholder="inherit default"
              value={maxMb}
              onChange={(e) => setMaxMb(e.target.value)}
            />
          </FormField>
          <FormField label="Max file count">
            <Input
              type="number"
              min={1}
              placeholder="inherit default"
              value={maxCount}
              onChange={(e) => setMaxCount(e.target.value)}
            />
          </FormField>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </div>
        <p className="mt-3 text-xs text-[var(--color-neutral-700)]">
          Leave blank to inherit the deployment defaults. Values above the
          deployment ceiling are clamped on send.
        </p>
      </CardBody>
    </Card>
  );
}
