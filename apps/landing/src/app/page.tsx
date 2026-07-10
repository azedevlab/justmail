import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Copy,
  Globe2,
  ListChecks,
  Lock,
  Mail,
  Puzzle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Trust />
      <Features />
      <Ecosystem />
      <CTA />
    </main>
  );
}

function Hero() {
  return (
    <section className="grid-radial">
      <div className="container-p py-24 md:py-32 text-center relative">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-neutral-900)] mb-6">
          <Sparkles size={12} /> Open source · Self-hosted · AGPL-3.0
        </div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
          The mail server <br />
          <span className="gradient-text">you actually want to run.</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-[var(--color-neutral-1000)]">
          A modern control plane over the mail stacks you already trust
          (Postfix, Dovecot, Rspamd). Deliverability wired for you, DNS
          automated, backups, webmail, and a plugin system that treats mail
          like a product.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/download"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white font-medium hover:brightness-110"
          >
            Install now <ArrowRight size={14} />
          </Link>
          <a
            href="https://github.com/justmaildev/justmail"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border-strong)] font-medium hover:bg-white/[0.04]"
          >
            Star on GitHub
          </a>
        </div>
        <InstallLine />
      </div>
    </section>
  );
}

function InstallLine() {
  return (
    <div className="mt-12 mx-auto max-w-2xl card-glass p-4 text-left">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-neutral-900)] mb-2">
        Ubuntu · one line
      </div>
      <div className="flex items-center justify-between gap-3 mono text-sm">
        <code className="truncate">
          curl -fsSL https://get.justmail.dev | sudo bash
        </code>
        <button
          aria-label="Copy command"
          className="p-1.5 rounded-md hover:bg-white/5 text-[var(--color-neutral-900)]"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
}

function Trust() {
  return (
    <section className="container-p pt-12 pb-16 text-center">
      <p className="text-xs uppercase tracking-widest text-[var(--color-neutral-800)]">
        Built on the workhorses of the internet
      </p>
      <div className="mt-6 flex items-center justify-center gap-8 text-[var(--color-neutral-900)] text-sm font-medium flex-wrap">
        <span>Postfix</span>
        <span>Dovecot</span>
        <span>Rspamd</span>
        <span>ClamAV</span>
        <span>PostgreSQL</span>
        <span>Redis</span>
        <span>Traefik</span>
        <span>Radicale</span>
        <span>Vector</span>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Globe2 size={20} />,
      title: "DNS Center",
      body: "SPF, DKIM, DMARC, MTA-STS, TLS-RPT, BIMI, CAA all seeded and synced to your provider with one click. Drift detected automatically.",
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Deliverability first",
      body: "ARC seals for forwarded mail. IP warmup enforced by the postfix policy service. DMARC aggregate + DNSBL monitoring baked in.",
    },
    {
      icon: <Mail size={20} />,
      title: "A webmail worth using",
      body: "Conversation view, keyboard-first navigation, snooze, scheduled send, undo send, and a composer that competes with Gmail.",
    },
    {
      icon: <Boxes size={20} />,
      title: "Object storage abstraction",
      body: "Attachments stream to S3, R2, MinIO, Backblaze, Azure, or GCS. Content-addressed, virus-scanned, thumbnailed.",
    },
    {
      icon: <Lock size={20} />,
      title: "Enterprise auth",
      body: "OIDC + SSO, Passkeys, TOTP, session device trust, per-org policy engine, RLS enforced at the database.",
    },
    {
      icon: <Puzzle size={20} />,
      title: "Plugin system",
      body: "Sandboxed server and client extensions. Signed manifests, capability-based hosts, marketplace on the way.",
    },
    {
      icon: <ListChecks size={20} />,
      title: "Backups + DR",
      body: "Nightly encrypted backups. Weekly restore drills verify integrity. Migration adapters from iRedMail, Mailcow, Postfixadmin.",
    },
    {
      icon: <Sparkles size={20} />,
      title: "PWA + realtime",
      body: "Install as a desktop app. WebSocket-powered live updates. Offline shell for the times the network drops.",
    },
  ];
  return (
    <section className="container-p py-16" id="features">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Everything a modern mail platform should be
        </h2>
        <p className="mt-3 text-[var(--color-neutral-1000)] max-w-2xl mx-auto">
          A control plane you don&apos;t regret. Every mutation audited, every
          screen keyboard-friendly, every feature scriptable through the API.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="card-glass p-5 hover:border-[var(--color-border-strong)] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[color:color-mix(in_oklab,_var(--color-brand-500)_15%,_transparent)] text-[var(--color-brand-400)] grid place-items-center mb-4">
              {f.icon}
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-[var(--color-neutral-1000)] mt-1">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ecosystem() {
  return (
    <section className="container-p py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            An ecosystem, not a monolith
          </h2>
          <p className="mt-3 text-[var(--color-neutral-1000)]">
            JustMail ships a signed plugin protocol, a theme engine, an
            OpenAPI-generated TypeScript SDK, and OAuth-friendly bearer tokens.
            Build integrations without forking the core.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <Link
              href="/docs/latest/plugin-development"
              className="text-sm text-[var(--color-brand-400)] hover:underline inline-flex items-center gap-1"
            >
              Build a plugin <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="card-glass p-6 font-mono text-xs leading-relaxed">
          <div className="text-[var(--color-neutral-900)] mb-2">
            {"// server plugin"}
          </div>
          <pre className="overflow-x-auto">
{`export default definePlugin({
  manifest: {
    name: "slack-notifier",
    version: "1.0.0",
    slots: ["notifications:channel"],
    permissions: ["notifications:send"],
  },
  init(host) {
    host.log.info("slack-notifier online");
  },
  hooks: {
    async onMailboxCreated(host, event) {
      await host.fetch("https://hooks.slack.com/…", {
        method: "POST",
        body: JSON.stringify({
          text: \`New mailbox: \${event.address}\`,
        }),
      });
    },
  },
});`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="container-p py-16 text-center">
      <div className="card-glass p-12">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Run your own mail. Own your data.
        </h2>
        <p className="mt-3 text-[var(--color-neutral-1000)] max-w-2xl mx-auto">
          JustMail is AGPL-3.0 for the platform, Apache-2.0 for the SDKs.
          Fork it, extend it, self-host it. No lock-in, ever.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/download"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white font-medium hover:brightness-110"
          >
            Install now <ArrowRight size={14} />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--color-border-strong)] font-medium hover:bg-white/[0.04]"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}
