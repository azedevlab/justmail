"use client";
import { Badge, Card, PageBody, PageHeader } from "@justmail/shared-ui";
import { Check } from "lucide-react";

const SWATCHES: { name: string; vars: [string, string, string]; active?: boolean }[] = [
  { name: "Meridian Light", vars: ["#F7F8FA", "#FFFFFF", "#7C5CFF"], active: true },
  { name: "Aurora Dark", vars: ["#0B0D12", "#13161C", "#9D85FF"] },
  { name: "Custom", vars: ["#F7F8FA", "#FFFFFF", "#0EA5E9"] },
];

export default function ThemesPage() {
  return (
    <>
      <PageHeader
        title="Themes"
        description="Brand the console, webmail, and login pages per organization or per domain."
        actions={<Badge tone="brand">Coming soon</Badge>}
      />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SWATCHES.map((t) => (
            <Card key={t.name} className="p-4">
              <div
                className="h-24 rounded-lg border border-[var(--color-border)] mb-3 relative overflow-hidden"
                style={{ background: t.vars[0] }}
                aria-hidden
              >
                <div
                  className="absolute left-3 top-3 right-3 h-6 rounded-md shadow-sm"
                  style={{ background: t.vars[1] }}
                />
                <div
                  className="absolute left-3 top-12 w-16 h-5 rounded-md"
                  style={{ background: t.vars[2] }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-neutral-1100)]">
                  {t.name}
                </span>
                {t.active ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--color-accent)] font-medium">
                    <Check size={13} /> Active
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-neutral-800)]">
                    Preview
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
            How themes will work
          </h3>
          <p className="text-[13px] text-[var(--color-neutral-900)] mt-1 leading-relaxed max-w-2xl">
            A theme is a set of design-token overrides — colors, fonts, radius,
            and logo — stored per organization or per domain. Saved themes apply
            instantly to the admin console, webmail, and hosted login pages
            without a rebuild. The editor lands in an upcoming release; the
            token pipeline that powers it already ships with JustMail.
          </p>
        </Card>
      </PageBody>
    </>
  );
}
