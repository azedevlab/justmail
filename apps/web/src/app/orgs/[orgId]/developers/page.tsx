"use client";
import { useQuery } from "@tanstack/react-query";
import { api, API_BASE } from "../../../../lib/api";
import { PageBody, PageHeader } from "../../../../components/shell";

interface OpenApiSpec {
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string }>>;
}

export default function DevPortal() {
  const spec = useQuery({
    queryKey: ["openapi"],
    queryFn: () => api.get<OpenApiSpec>("/openapi.json"),
  });

  const groups = groupPaths(spec.data?.paths ?? {});

  return (
    <>
      <PageHeader
        title="Developer Portal"
        description="OpenAPI 3.1 spec, endpoint reference, and code samples."
        actions={
          <a
            className="btn btn-secondary"
            href={`${API_BASE}/openapi.json`}
            download="justmail-openapi.json"
          >
            Download spec
          </a>
        }
      />
      <PageBody>
        <div className="card p-5">
          <div className="text-sm font-medium mb-2">Authentication</div>
          <p className="text-sm text-[var(--color-ink-300)] mb-3">
            All requests carry either the <code className="mono">jm_session</code>{" "}
            cookie (browser) or a <code className="mono">Bearer</code> token
            (issued in the API keys screen).
          </p>
          <div className="card p-3 mono text-xs">
            {`curl -H "Authorization: Bearer $JM_TOKEN" ${API_BASE}/v1/orgs`}
          </div>
        </div>

        {Object.entries(groups).map(([tag, endpoints]) => (
          <div key={tag} className="card overflow-hidden">
            <div className="p-4 border-b border-white/5 text-sm font-medium capitalize">
              {tag}
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={`${e.method} ${e.path}`}>
                    <td>
                      <span
                        className={
                          "badge " +
                          (e.method === "get"
                            ? "badge-ok"
                            : e.method === "delete"
                            ? "badge-bad"
                            : "badge-warn")
                        }
                      >
                        {e.method.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono text-xs">{e.path}</td>
                    <td className="text-sm">{e.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </PageBody>
    </>
  );
}

function groupPaths(paths: Record<string, Record<string, { summary: string }>>) {
  const groups: Record<string, Array<{ method: string; path: string; summary: string }>> = {};
  for (const [path, methods] of Object.entries(paths)) {
    const tag = path.split("/")[1] || "root";
    for (const [method, op] of Object.entries(methods)) {
      (groups[tag] ??= []).push({ method, path, summary: op.summary });
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => a.path.localeCompare(b.path));
  }
  return groups;
}
