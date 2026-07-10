"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { SettingRow } from "@justmail/contracts";
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
