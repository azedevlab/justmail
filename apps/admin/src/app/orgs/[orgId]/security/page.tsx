"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  BlockedIp,
  CreateBlockedIpRequest,
  SecurityScore,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
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
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

export default function SecurityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showBlock, setShowBlock] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const score = useQuery({
    queryKey: ["security-score", orgId],
    queryFn: () =>
      api.get<SecurityScore>(`/v1/orgs/${orgId}/security/score`),
  });
  const blocked = useQuery({
    queryKey: ["blocked-ips", orgId],
    queryFn: () =>
      api.get<BlockedIp[]>(`/v1/orgs/${orgId}/security/blocked-ips`),
  });
  const unblock = useMutation({
    mutationFn: (id: string) =>
      api.del(`/v1/orgs/${orgId}/security/blocked-ips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-ips", orgId] });
      toast({ title: "IP unblocked", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Security"
        description="Deliverability score, blocked IPs, and mail-plane hardening."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowBlock(true)}
          >
            Block IP
          </Button>
        }
      />
      <PageBody>
        {score.data && (
          <Card>
            <CardHeader>
              <CardTitle>Deliverability score</CardTitle>
              <div className="text-3xl font-semibold font-mono">
                {score.data.score}
                <span className="text-[var(--color-neutral-900)] text-lg">
                  /100
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {score.data.factors.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3 text-sm"
                  >
                    <span>{f.label}</span>
                    <Badge tone={f.ok ? "ok" : "warn"}>
                      {f.ok ? "OK" : "Missing"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Blocked IPs</CardTitle>
          </CardHeader>
          <CardBody>
            {blocked.isLoading && <SkeletonRows count={3} />}
            {blocked.data && blocked.data.length === 0 && (
              <Empty
                title="Nothing blocked yet"
                description="Fail2Ban populates this list automatically as brute-force attempts arrive."
              />
            )}
            {blocked.data && blocked.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH>IP</TH>
                    <TH>Source</TH>
                    <TH>Reason</TH>
                    <TH>Expires</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <tbody>
                  {blocked.data.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <span className="mono">{b.ip}</span>
                      </TD>
                      <TD>
                        <Badge tone="muted">{b.source}</Badge>
                      </TD>
                      <TD>{b.reason || "—"}</TD>
                      <TD className="text-xs">
                        {b.expires_at
                          ? new Date(b.expires_at).toLocaleString()
                          : "never"}
                      </TD>
                      <TD className="text-right">
                        <button
                          className="text-xs text-[var(--color-brand-400)] hover:underline"
                          onClick={() => unblock.mutate(b.id)}
                        >
                          Unblock
                        </button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageBody>
      {showBlock && <BlockModal orgId={orgId} onClose={() => setShowBlock(false)} />}
    </>
  );
}

function BlockModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const f = useForm<CreateBlockedIpRequest>({
    defaultValues: { ip: "", reason: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateBlockedIpRequest) =>
      api.post(`/v1/orgs/${orgId}/security/blocked-ips`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-ips", orgId] });
      toast({ title: "IP blocked", tone: "ok" });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Block IP"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={mut.isPending}
            onClick={f.handleSubmit((v) => {
              setErr(null);
              mut.mutate(v);
            })}
          >
            Block
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="IP or CIDR">
          <Input
            monospace
            placeholder="203.0.113.42 or 203.0.113.0/24"
            autoFocus
            {...f.register("ip", { required: true })}
          />
        </FormField>
        <FormField label="Reason" hint="Optional; visible in audit log">
          <Input {...f.register("reason")} />
        </FormField>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
