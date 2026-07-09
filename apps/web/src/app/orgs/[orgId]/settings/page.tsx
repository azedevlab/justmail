"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/api";
import { PageBody, PageHeader } from "../../../../components/shell";

interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

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
        description="Platform preferences and integrations. Values persist to the database — never a config file."
      />
      <PageBody>
        <div className="card p-5">
          <div className="text-sm font-medium mb-3">Values</div>
          {list.data && list.data.length === 0 && (
            <p className="text-sm text-[var(--color-ink-300)]">
              No settings stored yet. Modules will register defaults here as they land.
            </p>
          )}
          {list.data && list.data.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((r) => (
                  <tr key={r.key}>
                    <td className="mono text-xs">{r.key}</td>
                    <td className="mono text-xs max-w-md truncate">
                      {JSON.stringify(r.value)}
                    </td>
                    <td className="text-xs text-[var(--color-ink-300)]">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageBody>
    </>
  );
}
