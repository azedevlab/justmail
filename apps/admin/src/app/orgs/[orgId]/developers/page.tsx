"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, CardTitle, PageBody, PageHeader, Badge, Table, TD, TH, THead, TR } from "@justmail/shared-ui";
import { api, API_BASE } from "@/lib/api";

interface OpenApiSpec {
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, { summary?: string; tags?: string[] }>>;
}

export default function DeveloperPortal() {
  const spec = useQuery({
    queryKey: ["openapi"],
    queryFn: () => api.get<OpenApiSpec>("/openapi.json"),
  });

  const groups = groupPaths(spec.data?.paths ?? {});

  return (
    <>
      <PageHeader
        title="Developer Portal"
        description="OpenAPI 3.1 spec, endpoint reference, and copy-pastable examples."
        actions={
          <a
            className="text-sm text-[var(--color-brand-400)] hover:underline"
            href={`${API_BASE}/openapi.json`}
            download="justmail-openapi.json"
          >
            Download spec ↓
          </a>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-[var(--color-neutral-900)]">
              Every request carries either the{" "}
              <code className="mono">jm_session</code> cookie (browser) or a{" "}
              <code className="mono">Bearer</code> token issued in the API keys
              screen.
            </p>
            <pre className="p-3 rounded-md bg-[var(--color-neutral-100)] border border-[var(--color-border)] mono text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer $JM_TOKEN" \\
  ${API_BASE}/v1/orgs`}
            </pre>
          </CardBody>
        </Card>

        {Object.entries(groups).map(([tag, endpoints]) => (
          <Card key={tag}>
            <CardHeader>
              <CardTitle className="capitalize">{tag}</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <THead>
                  <TR>
                    <TH>Method</TH>
                    <TH>Path</TH>
                    <TH>Summary</TH>
                  </TR>
                </THead>
                <tbody>
                  {endpoints.map((e) => (
                    <TR key={`${e.method} ${e.path}`}>
                      <TD>
                        <Badge
                          tone={
                            e.method === "get"
                              ? "ok"
                              : e.method === "delete"
                                ? "bad"
                                : "warn"
                          }
                        >
                          {e.method.toUpperCase()}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="mono text-xs">{e.path}</span>
                      </TD>
                      <TD className="text-sm">{e.summary}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          </Card>
        ))}
      </PageBody>
    </>
  );
}

function groupPaths(paths: OpenApiSpec["paths"]) {
  const groups: Record<
    string,
    Array<{ method: string; path: string; summary: string }>
  > = {};
  for (const [path, methods] of Object.entries(paths)) {
    const tag = path.split("/")[1] || "root";
    for (const [method, op] of Object.entries(methods)) {
      (groups[tag] ??= []).push({ method, path, summary: op.summary ?? "" });
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => a.path.localeCompare(b.path));
  }
  return groups;
}
