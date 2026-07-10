"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { DmarcReport } from "@justmail/contracts";
import {
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
                    <TH>Reporter</TH>
                    <TH>Domain</TH>
                    <TH>Pass</TH>
                    <TH>Fail</TH>
                    <TH>Window</TH>
                  </TR>
                </THead>
                <tbody>
                  {dmarc.data.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <span className="mono text-xs">{r.reporter}</span>
                      </TD>
                      <TD>
                        <span className="mono text-xs">
                          {r.domain_name ?? "—"}
                        </span>
                      </TD>
                      <TD className="text-[var(--color-ok)] font-mono">
                        {r.pass}
                      </TD>
                      <TD className="text-[var(--color-bad)] font-mono">
                        {r.fail}
                      </TD>
                      <TD className="text-xs">
                        {new Date(r.begin_ts).toLocaleDateString()} →{" "}
                        {new Date(r.end_ts).toLocaleDateString()}
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
