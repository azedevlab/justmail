"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  DmarcReport,
  DmarcReportDetail,
  ReputationDay,
} from "@justmail/contracts";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
  PageBody,
  PageHeader,
  SkeletonRows,
  Table,
  TD,
  TH,
  THead,
  TR,
} from "@justmail/shared-ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

export default function DeliverabilityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const dmarc = useQuery({
    queryKey: ["dmarc", orgId],
    queryFn: () =>
      api.get<DmarcReport[]>(`/v1/orgs/${orgId}/deliverability/dmarc`),
  });

  return (
    <>
      <PageHeader
        title="Deliverability"
        description="DMARC aggregate reports, DNSBL health, sender reputation."
      />
      <PageBody>
        <ReputationTrend orgId={orgId} />
        <Card>
          <CardHeader>
            <CardTitle>DMARC aggregate reports</CardTitle>
          </CardHeader>
          <CardBody>
            {dmarc.isLoading && <SkeletonRows count={3} />}
            {dmarc.data && dmarc.data.length === 0 && (
              <Empty
                title="No reports yet"
                description="Configure DMARC to send rua=mailto:dmarc@yourdomain, then reports arrive within 24 h."
              />
            )}
            {dmarc.data && dmarc.data.length > 0 && (
              <Table>
                <THead>
                  <TR>
                    <TH></TH>
                    <TH>Reporter</TH>
                    <TH>Domain</TH>
                    <TH>Pass</TH>
                    <TH>Fail</TH>
                    <TH>Window</TH>
                  </TR>
                </THead>
                <tbody>
                  {dmarc.data.map((r) => (
                    <ReportRow key={r.id} orgId={orgId} report={r} />
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

const SERIES = [
  { key: "sent", label: "Sent", color: "var(--color-ok)" },
  { key: "deferred", label: "Deferred", color: "var(--color-warn)" },
  { key: "bounced", label: "Bounced", color: "var(--color-bad)" },
  { key: "complained", label: "Complaints", color: "var(--color-accent)" },
] as const;

function ReputationTrend({ orgId }: { orgId: string }) {
  const rep = useQuery({
    queryKey: ["reputation", orgId],
    queryFn: () =>
      api.get<ReputationDay[]>(`/v1/orgs/${orgId}/deliverability/reputation`),
  });
  const days = rep.data ?? [];
  const totals = days.reduce(
    (a, d) => ({
      sent: a.sent + d.sent,
      deferred: a.deferred + d.deferred,
      bounced: a.bounced + d.bounced,
      complained: a.complained + d.complained,
    }),
    { sent: 0, deferred: 0, bounced: 0, complained: 0 },
  );
  const max = Math.max(
    1,
    ...days.map((d) => d.sent + d.deferred + d.bounced + d.complained),
  );
  const attempted = totals.sent + totals.bounced;
  const bounceRate = attempted ? (totals.bounced / attempted) * 100 : 0;
  const complaintRate = totals.sent
    ? (totals.complained / totals.sent) * 100
    : 0;
  const hasActivity = days.some(
    (d) => d.sent + d.deferred + d.bounced + d.complained > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sender reputation (30 days)</CardTitle>
      </CardHeader>
      <CardBody>
        {rep.isLoading && <SkeletonRows count={3} />}
        {rep.data && !hasActivity && (
          <Empty
            title="No outbound activity yet"
            description="Once mailboxes start sending, delivery outcomes are charted here daily."
          />
        )}
        {rep.data && hasActivity && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RepStat label="Sent" value={totals.sent.toLocaleString()} />
              <RepStat
                label="Bounce rate"
                value={`${bounceRate.toFixed(1)}%`}
                tone={bounceRate >= 5 ? "bad" : bounceRate >= 2 ? "warn" : "ok"}
              />
              <RepStat
                label="Complaint rate"
                value={`${complaintRate.toFixed(2)}%`}
                tone={
                  complaintRate >= 0.3
                    ? "bad"
                    : complaintRate >= 0.1
                      ? "warn"
                      : "ok"
                }
              />
              <RepStat
                label="Deferred"
                value={totals.deferred.toLocaleString()}
              />
            </div>

            <div
              className="flex items-end gap-[2px] h-32"
              role="img"
              aria-label="Daily delivery outcomes"
            >
              {days.map((d) => {
                const total = d.sent + d.deferred + d.bounced + d.complained;
                return (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col-reverse min-w-[3px] rounded-sm overflow-hidden bg-[var(--color-surface-2)]"
                    style={{ height: "100%" }}
                    title={`${d.day} · ${d.sent} sent · ${d.deferred} deferred · ${d.bounced} bounced · ${d.complained} complaints`}
                  >
                    {SERIES.map((s) => {
                      const v = d[s.key];
                      if (!v) return null;
                      return (
                        <div
                          key={s.key}
                          style={{
                            height: `${(v / max) * 100}%`,
                            backgroundColor: s.color,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-neutral-900)]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-[3px]"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RepStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--color-neutral-800)]">
        {label}
      </div>
      <div
        className={
          "mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular-nums leading-none " +
          (tone === "bad"
            ? "text-[var(--color-bad)]"
            : tone === "warn"
              ? "text-[var(--color-warn)]"
              : tone === "ok"
                ? "text-[var(--color-ok)]"
                : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function ReportRow({ orgId, report }: { orgId: string; report: DmarcReport }) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["dmarc", orgId, report.id],
    queryFn: () =>
      api.get<DmarcReportDetail>(
        `/v1/orgs/${orgId}/deliverability/dmarc/${report.id}`,
      ),
    enabled: open,
  });

  return (
    <>
      <TR className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TD className="w-6 text-[var(--color-neutral-800)]">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </TD>
        <TD>
          <span className="mono text-xs">{report.reporter}</span>
        </TD>
        <TD>
          <span className="mono text-xs">{report.domain_name ?? "—"}</span>
        </TD>
        <TD className="text-[var(--color-ok)] font-mono">{report.pass}</TD>
        <TD className="text-[var(--color-bad)] font-mono">{report.fail}</TD>
        <TD className="text-xs">
          {new Date(report.begin_ts).toLocaleDateString()} →{" "}
          {new Date(report.end_ts).toLocaleDateString()}
        </TD>
      </TR>
      {open && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-[var(--color-surface-2)] px-4 py-3">
              {detail.isLoading && <SkeletonRows count={2} />}
              {detail.data && detail.data.records.length === 0 && (
                <p className="text-xs text-[var(--color-neutral-800)]">
                  No per-source rows recorded for this report.
                </p>
              )}
              {detail.data && detail.data.records.length > 0 && (
                <Table>
                  <THead>
                    <TR>
                      <TH>Source IP</TH>
                      <TH>Messages</TH>
                      <TH>Disposition</TH>
                      <TH>DKIM</TH>
                      <TH>SPF</TH>
                      <TH>Header from</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {detail.data.records.map((rec, i) => (
                      <TR key={`${rec.source_ip}-${i}`}>
                        <TD>
                          <span className="mono text-xs">
                            {rec.source_ip || "—"}
                          </span>
                        </TD>
                        <TD className="font-mono text-xs">{rec.count}</TD>
                        <TD>
                          <Badge
                            tone={
                              rec.disposition === "reject"
                                ? "bad"
                                : rec.disposition === "quarantine"
                                  ? "warn"
                                  : "muted"
                            }
                          >
                            {rec.disposition}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={rec.dkim_pass ? "ok" : "bad"}>
                            {rec.dkim_pass ? "pass" : "fail"}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge tone={rec.spf_pass ? "ok" : "bad"}>
                            {rec.spf_pass ? "pass" : "fail"}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="mono text-xs">
                            {rec.header_from ?? "—"}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
