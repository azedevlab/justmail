"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
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

interface AuditEntry {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export default function AuditPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const list = useQuery({
    queryKey: ["audit", orgId],
    queryFn: () =>
      api.get<AuditEntry[]>(`/v1/orgs/${orgId}/audit?limit=100`).catch(() => []),
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Immutable record of every write. Exportable and retained per your policy."
      />
      <PageBody>
        <Card className="overflow-hidden">
          {list.isLoading && <SkeletonRows count={5} />}
          {list.data && list.data.length === 0 && (
            <Empty title="No audit entries yet" />
          )}
          {list.data && list.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Target</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((e) => (
                  <TR key={e.id}>
                    <TD className="text-xs">
                      {new Date(e.created_at).toLocaleString()}
                    </TD>
                    <TD>
                      <span className="mono text-xs">
                        {e.actor_type}:{e.actor_id?.slice(0, 8) ?? "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="mono text-xs">{e.action}</span>
                    </TD>
                    <TD>
                      <span className="mono text-xs">
                        {e.target_type ?? "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="mono text-xs">{e.ip ?? "—"}</span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </PageBody>
    </>
  );
}
