"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  BlockedIp,
  CountryBlock,
  CreateBlockedIpRequest,
  IpWarmup,
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
  Checkbox,
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
                          className="text-xs text-[var(--color-accent)] hover:underline"
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

        <CountryBlockCard orgId={orgId} />
        <WarmupCard orgId={orgId} />
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

function CountryBlockCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ["country-block", orgId],
    queryFn: () =>
      api.get<CountryBlock>(`/v1/orgs/${orgId}/security/country-block`),
  });
  const [enabled, setEnabled] = useState(false);
  const [countries, setCountries] = useState("");

  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setCountries(q.data.countries.join(", "));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: CountryBlock) =>
      api.put(`/v1/orgs/${orgId}/security/country-block`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["country-block", orgId] });
      toast({ title: "Country block saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError
            ? e.problem.detail ?? e.problem.title
            : (e as Error).message,
        tone: "bad",
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Country block</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {q.isLoading && <SkeletonRows count={2} />}
        {q.data && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Reject SMTP connections from the listed countries
            </label>
            <FormField
              label="Country codes (ISO 3166-1 alpha-2, comma-separated)"
              hint="Example: RU, KP, CN"
            >
              <Input
                monospace
                placeholder="RU, KP"
                value={countries}
                onChange={(e) => setCountries(e.target.value)}
              />
            </FormField>
            <div>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() =>
                  save.mutate({
                    enabled,
                    countries: countries
                      .split(/[\s,]+/)
                      .map((c) => c.trim().toUpperCase())
                      .filter(Boolean),
                  })
                }
              >
                Save country block
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function WarmupCard({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({
    queryKey: ["ip-warmup", orgId],
    queryFn: () =>
      api.get<IpWarmup | null>(`/v1/orgs/${orgId}/security/ip-warmup`),
  });
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(30);
  const [start, setStart] = useState(50);
  const [target, setTarget] = useState(50_000);

  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setDays(q.data.days);
      setStart(q.data.daily_limit_start);
      setTarget(q.data.daily_limit_target);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: IpWarmup) =>
      api.put(`/v1/orgs/${orgId}/security/ip-warmup`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ip-warmup", orgId] });
      toast({ title: "IP warmup saved", tone: "ok" });
    },
    onError: (e) =>
      toast({
        title:
          e instanceof ApiError
            ? e.problem.detail ?? e.problem.title
            : (e as Error).message,
        tone: "bad",
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>IP warmup</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {q.isLoading && <SkeletonRows count={2} />}
        {!q.isLoading && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Ramp the outbound daily send limit for a fresh sending IP
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Warmup period (days)">
                <Input
                  type="number"
                  monospace
                  min={1}
                  max={90}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Starting daily limit">
                <Input
                  type="number"
                  monospace
                  min={1}
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Target daily limit">
                <Input
                  type="number"
                  monospace
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                />
              </FormField>
            </div>
            <div>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() =>
                  save.mutate({
                    enabled,
                    started_at: q.data?.started_at ?? new Date().toISOString(),
                    days,
                    daily_limit_start: start,
                    daily_limit_target: target,
                  })
                }
              >
                Save warmup plan
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
