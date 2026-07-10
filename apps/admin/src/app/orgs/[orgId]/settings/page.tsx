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
  Table,
  TD,
  TH,
  THead,
  TR,
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
        description="Platform preferences. Values live in the database — never in a config file."
      />
      <PageBody>
        <AttachmentLimitsCard orgId={orgId} rows={list.data} />
        <Card>
          <CardHeader>
            <CardTitle>Stored values</CardTitle>
          </CardHeader>
          <CardBody>
            {list.isLoading && <SkeletonRows count={3} />}
            {list.data && list.data.length === 0 && (
              <Empty
                title="No settings stored yet"
                description="Modules register defaults as they land."
              />
            )}
            {list.data && list.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>Key</TH>
                    <TH>Value</TH>
                    <TH>Updated</TH>
                  </TR>
                </THead>
                <tbody>
                  {list.data.map((r) => (
                    <TR key={r.key}>
                      <TD>
                        <span className="mono text-xs">{r.key}</span>
                      </TD>
                      <TD>
                        <span className="mono text-xs">
                          {JSON.stringify(r.value)}
                        </span>
                      </TD>
                      <TD className="text-xs">
                        {new Date(r.updated_at).toLocaleString()}
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
