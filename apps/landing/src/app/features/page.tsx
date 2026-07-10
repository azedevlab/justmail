export default function FeaturesPage() {
  return (
    <main className="container-p py-16 max-w-4xl">
      <h1 className="text-4xl font-semibold tracking-tight mb-6">Features</h1>
      <div className="space-y-10 text-[var(--color-neutral-1000)] leading-relaxed">
        <Feature
          title="Deliverability wired for you"
          points={[
            "SPF, DKIM (RSA-2048 or Ed25519), DMARC, MTA-STS, TLS-RPT, BIMI, and CAA seeded on new domains.",
            "ARC seals for forwarded mail so downstream recipients still trust the chain.",
            "IP warmup schedules enforced by the postfix policy service — not honour-system settings.",
            "DMARC aggregate + forensic report ingestion with per-source drilldowns.",
            "DNSBL monitoring across Spamhaus, SpamCop, Barracuda, and CBL by default.",
          ]}
        />
        <Feature
          title="An admin console you look forward to opening"
          points={[
            "Command palette (⌘K) with every action within one keystroke.",
            "Every screen has loading, empty, error, and offline states.",
            "Realtime updates via WebSocket. Optimistic UI. Undo toasts on destructive actions.",
            "Dark, light, and high-contrast themes. Ultra-wide monitor layouts.",
            "Accessibility to WCAG 2.2 AA on every screen.",
          ]}
        />
        <Feature
          title="A webmail that competes with Gmail"
          points={[
            "Conversation view, thread reader, keyboard-first navigation.",
            "TipTap rich composer with markdown / HTML / plaintext toggle.",
            "Snooze, star, pin, labels, categories.",
            "Undo send with server-side hold. Scheduled send. Templates and signatures.",
            "Full-text search backed by Dovecot FTS with saved queries.",
            "Contacts and calendar via CardDAV / CalDAV sidecar.",
          ]}
        />
        <Feature
          title="Storage that scales"
          points={[
            "Adapter interface: Local FS, S3, Cloudflare R2, MinIO, Backblaze, Azure Blob, GCS.",
            "Content-addressed dedup per organization.",
            "tus.io resumable chunked uploads.",
            "ClamAV virus scan on ingest. Sandboxed thumbnail generation.",
            "Signed URLs, CDN passthrough headers.",
          ]}
        />
        <Feature
          title="Enterprise ready"
          points={[
            "Multi-org tenancy with team-tier sub-orgs.",
            "OIDC + SSO. Passkeys (WebAuthn). TOTP with recovery codes.",
            "Row-Level Security enforced at the database.",
            "Audit log on every mutation. Immutable append-only.",
            "Per-domain retention, GDPR export + delete CLI.",
            "SBOMs + signed container images.",
          ]}
        />
        <Feature
          title="Ecosystem"
          points={[
            "OpenAPI 3.1 spec generated from the schemas — no drift.",
            "TypeScript SDK ships in v1.0. Python + Go via OpenAPI Generator.",
            "Webhooks with HMAC-SHA256 signatures and 6-attempt exponential retry.",
            "Signed plugin manifests. Sandboxed server + client bundles.",
            "Theme engine with per-org and per-domain scopes.",
          ]}
        />
      </div>
    </main>
  );
}

function Feature({ title, points }: { title: string; points: string[] }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3 text-[var(--color-text)]">
        {title}
      </h2>
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="text-[var(--color-brand-400)] mt-1">◆</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
