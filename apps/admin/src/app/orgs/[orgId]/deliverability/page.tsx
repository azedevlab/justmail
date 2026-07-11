"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DmarcReport, DmarcReportDetail } from "@justmail/contracts";
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
