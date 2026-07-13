import { Copy } from "lucide-react";

export default function DownloadPage() {
  return (
    <main className="container-p py-16 max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight mb-3">Install JustMail</h1>
      <p className="text-[var(--color-neutral-1000)] mb-10">
        Three ways to get running. Ubuntu is the fastest; Kubernetes is the
        cluster-ready path.
      </p>

      <Section title="Ubuntu 24.04+" recommended>
        <Cmd cmd="curl -fsSL https://raw.githubusercontent.com/azedevlab/justmail/main/scripts/install.sh | sudo bash" />
        <p className="mt-3 text-sm text-[var(--color-neutral-1000)]">
          The installer verifies prerequisites, sets up Docker, generates
          secrets, seeds the initial admin, and issues LetsEncrypt certs.
        </p>
      </Section>

      <Section title="Docker Compose">
        <Cmd
          cmd={
            "git clone https://github.com/azedevlab/justmail\n" +
            "cd justmail/services/compose\n" +
            "cp .env.example .env    # edit hostnames and secrets\n" +
            "docker compose --profile core --profile mail --profile app up -d"
          }
        />
      </Section>

      <Section title="Kubernetes (HA)">
        <Cmd
          cmd={
            "git clone https://github.com/azedevlab/justmail.git\n" +
            "helm install justmail ./justmail/services/helm/justmail \\\n" +
            "  --namespace justmail --create-namespace \\\n" +
            "  --values values.yaml"
          }
        />
      </Section>

      <Section title="Terraform">
        <p className="text-sm text-[var(--color-neutral-1000)]">
          Modules for AWS, Hetzner, and DigitalOcean. See{" "}
          <a
            href="https://github.com/azedevlab/justmail/tree/main/services/terraform"
            className="underline"
          >
            services/terraform
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
  recommended,
}: {
  title: string;
  children: React.ReactNode;
  recommended?: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        {title}
        {recommended && (
          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-[color:color-mix(in_oklab,_var(--color-brand-500)_20%,_transparent)] text-[var(--color-brand-400)]">
            recommended
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Cmd({ cmd }: { cmd: string }) {
  return (
    <div className="card-glass p-4 mono text-sm relative">
      <pre className="whitespace-pre-wrap">{cmd}</pre>
      <button
        aria-label="Copy"
        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/5 text-[var(--color-neutral-900)]"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}
