"use client";
import { Badge, Card, PageBody, PageHeader } from "@justmail/shared-ui";
import { KeyRound, Puzzle, ShieldCheck, Terminal, Webhook } from "lucide-react";
import type { ReactNode } from "react";

const PLANNED = [
  {
    icon: <ShieldCheck size={16} />,
    title: "Signed & sandboxed",
    body: "Every plugin runs in an isolated worker with a declared permission manifest. No plugin touches raw mail without asking.",
  },
  {
    icon: <Webhook size={16} />,
    title: "Hook the pipeline",
    body: "Intercept delivery, rewrite headers, filter spam, or fan out to external systems at any stage of the SMTP pipeline.",
  },
  {
    icon: <Puzzle size={16} />,
    title: "Marketplace in v1.1",
    body: "Browse, install, and update community plugins from this page. Until then, sideloading works today.",
  },
];

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 shrink-0 grid place-items-center rounded-full bg-[color:rgb(124_92_255/0.10)] text-[var(--color-accent)] text-[11px] font-semibold tabular-nums mt-px">
        {n}
      </span>
      <span className="text-sm text-[var(--color-neutral-1000)]">{children}</span>
    </li>
  );
}

export default function PluginsPage() {
  return (
    <>
      <PageHeader
        title="Plugins"
        description="Extend JustMail with signed, sandboxed plugins."
        actions={<Badge tone="brand">Coming in v1.1</Badge>}
      />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANNED.map((p) => (
            <Card key={p.title} className="p-5">
              <span className="w-9 h-9 grid place-items-center rounded-lg bg-[color:rgb(124_92_255/0.10)] text-[var(--color-accent)] mb-3">
                {p.icon}
              </span>
              <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                {p.title}
              </h3>
              <p className="text-[13px] text-[var(--color-neutral-900)] mt-1 leading-relaxed">
                {p.body}
              </p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Terminal size={15} className="text-[var(--color-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
              Sideload a plugin today
            </h3>
          </div>
          <ol className="space-y-2.5">
            <Step n={1}>
              Build against the plugin SDK and sign the bundle with your org key.
            </Step>
            <Step n={2}>
              <code className="mono px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">
                justmail plugin install ./my-plugin.jmp
              </code>{" "}
              on the host.
            </Step>
            <Step n={3}>
              Grant the requested permissions — the plugin appears here once
              loaded.
            </Step>
          </ol>
        </Card>

        <p className="text-xs text-[var(--color-neutral-800)] flex items-center gap-1.5">
          <KeyRound size={12} />
          Plugins never see mailbox passwords; they operate on scoped, revocable
          tokens.
        </p>
      </PageBody>
    </>
  );
}
