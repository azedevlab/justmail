import Link from "next/link";

const DOCS = [
  { slug: "installation", title: "Installation", body: "Ubuntu, Docker, Kubernetes, Terraform." },
  { slug: "architecture", title: "Architecture", body: "Monorepo layout, service boundaries, data flow." },
  { slug: "api", title: "API reference", body: "REST + WebSocket contract, OpenAPI spec." },
  { slug: "security", title: "Security", body: "Threat model, controls, disclosure policy." },
  { slug: "deployment", title: "Deployment", body: "Single-node compose, HA on Kubernetes." },
  { slug: "backups", title: "Backups & DR", body: "Nightly backups, restore drills, verification." },
  { slug: "plugins", title: "Plugin development", body: "Manifest, host API, sandbox model." },
  { slug: "themes", title: "Theme development", body: "Design tokens, per-domain overrides." },
];

export default function DocsIndex() {
  return (
    <main className="container-p py-16">
      <h1 className="text-4xl font-semibold tracking-tight mb-3">
        Documentation
      </h1>
      <p className="text-[var(--color-neutral-1000)] mb-10 max-w-2xl">
        Everything an operator or contributor needs, versioned per release.
        Full source at{" "}
        <a
          href="https://github.com/azedevlab/justmail/tree/main/docs"
          className="underline"
        >
          github.com/azedevlab/justmail/tree/main/docs
        </a>
        .
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOCS.map((d) => (
          <Link
            key={d.slug}
            href={`/docs/latest/${d.slug}`}
            className="card-glass p-5 hover:border-[var(--color-border-strong)]"
          >
            <h3 className="font-semibold">{d.title}</h3>
            <p className="text-sm text-[var(--color-neutral-1000)] mt-1">
              {d.body}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
