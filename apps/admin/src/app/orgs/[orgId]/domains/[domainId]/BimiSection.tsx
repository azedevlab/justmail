"use client";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BimiStatus } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Section,
  SkeletonRows,
  StatusBadge,
  useConfirm,
  useToast,
} from "@justmail/shared-ui";
import { AlertTriangle, ImageUp, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

const MAX_BYTES = 32 * 1024;

/**
 * Brand logo (BIMI). Domain-level: upload/replace/remove an SVG that mailbox
 * providers render next to the domain's mail. Self-contained so it can be
 * dropped into the domain detail page without touching sibling sections.
 */
export function BimiSection({
  orgId,
  domainId,
}: {
  orgId: string;
  domainId: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const bimi = useQuery({
    queryKey: ["domain-bimi", orgId, domainId],
    queryFn: () =>
      api.get<BimiStatus>(`/v1/orgs/${orgId}/domains/${domainId}/bimi`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["domain-bimi", orgId, domainId] });
    qc.invalidateQueries({ queryKey: ["domain-dns", orgId, domainId] });
  };
  const onError = (verb: string) => (e: unknown) =>
    toast({
      title: `Could not ${verb} logo`,
      description:
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : String(e),
      tone: "bad",
    });

  const upload = useMutation({
    mutationFn: (file: File) =>
      file.arrayBuffer().then((buf) =>
        api.put<BimiStatus>(`/v1/orgs/${orgId}/domains/${domainId}/bimi`, {
          content_type: file.type || "image/svg+xml",
          data_base64: bytesToBase64(new Uint8Array(buf)),
        }),
      ),
    onSuccess: () => {
      invalidate();
      toast({ title: "Brand logo saved", tone: "ok" });
    },
    onError: onError("upload"),
  });

  const remove = useMutation({
    mutationFn: () =>
      api.del<BimiStatus>(`/v1/orgs/${orgId}/domains/${domainId}/bimi`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Brand logo removed", tone: "ok" });
    },
    onError: onError("remove"),
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) {
      toast({ title: "Logo must be an SVG file", tone: "bad" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "Logo too large",
        description: `SVG must be under ${MAX_BYTES / 1024}KB.`,
        tone: "bad",
      });
      return;
    }
    setBusy(true);
    upload.mutate(file, { onSettled: () => setBusy(false) });
  };

  return (
    <Section
      title="Brand logo (BIMI)"
      description="Upload an SVG (Tiny P/S profile, under 32KB) so Gmail and Apple Mail can show your logo next to this domain's mail. The default._bimi DNS record below points at it."
      actions={
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/svg+xml,.svg"
            className="hidden"
            onChange={onPick}
          />
          <Button
            variant="primary"
            size="sm"
            loading={busy || upload.isPending}
            leadingIcon={<ImageUp size={14} />}
            onClick={() => fileRef.current?.click()}
          >
            {bimi.data?.has_logo ? "Replace logo" : "Upload logo"}
          </Button>
          {bimi.data?.has_logo && (
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              leadingIcon={<Trash2 size={14} />}
              onClick={async () => {
                if (
                  await confirm({
                    title: "Remove brand logo?",
                    body: "The logo stops being served and mail clients fall back to no icon. The DNS record stays in place.",
                    tone: "danger",
                    confirmLabel: "Remove",
                  })
                )
                  remove.mutate();
              }}
            >
              Remove
            </Button>
          )}
        </div>
      }
    >
      {bimi.isLoading && <SkeletonRows count={2} />}
      {bimi.data && (
        <Card className="p-5 space-y-4">
          {!bimi.data.dmarc_ok && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-3 text-sm text-[var(--color-neutral-1000)]"
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-[var(--color-warn)]"
              />
              <span>
                BIMI is ignored unless DMARC enforces{" "}
                <span className="mono">p=quarantine</span> or{" "}
                <span className="mono">p=reject</span>. This domain&apos;s policy
                is{" "}
                <span className="mono">
                  {bimi.data.dmarc_policy ?? "not set"}
                </span>
                {" — "}strengthen it in the DNS records above for the logo to
                appear.
              </span>
            </div>
          )}
          <div className="flex items-center gap-4">
            {bimi.data.has_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bimi.data.logo_data_url ?? bimi.data.logo_url}
                alt="Brand logo preview"
                className="h-12 w-12 rounded border border-[var(--color-neutral-400)] bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[var(--color-neutral-400)] text-[10px] text-[var(--color-neutral-800)]">
                none
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-[var(--color-neutral-900)]">
                DNS record{" "}
                <span className="mono">default._bimi.</span> (TXT)
              </p>
              <p className="mono break-all text-xs">{bimi.data.record}</p>
            </div>
          </div>
        </Card>
      )}
    </Section>
  );
}

// Chunked base64 so a large-ish SVG doesn't blow the argument stack of
// String.fromCharCode(...bytes).
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
