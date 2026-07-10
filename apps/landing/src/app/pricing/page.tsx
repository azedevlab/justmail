import { Check } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  const tiers = [
    {
      name: "Community",
      price: "Free",
      description: "Self-host and everything works.",
      features: [
        "Everything in the repo, AGPL-3.0",
        "GitHub Discussions support",
        "Unlimited mailboxes and domains",
        "Public docs + changelog",
      ],
      cta: { href: "/download", label: "Install now" },
    },
    {
      name: "Support",
      price: "€490 / mo",
      description: "For teams running JustMail in production.",
      features: [
        "Priority triage on GitHub issues",
        "Email support with 1 business day SLA",
        "Upgrade migration guidance",
        "Security advisory pre-notification",
      ],
      cta: { href: "mailto:hello@justmail.dev", label: "Talk to us" },
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Talk to us",
      description: "Regulated industries and 50 000+ mailbox estates.",
      features: [
        "SLA-backed 24/7 support",
        "Architecture review + capacity planning",
        "Private plugin publisher registry",
        "SOC-2 / HIPAA evidence packages",
      ],
      cta: { href: "mailto:enterprise@justmail.dev", label: "Contact sales" },
    },
  ];

  return (
    <main className="container-p py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Free to self-host. Paid support if you want it.
        </h1>
        <p className="mt-4 text-[var(--color-neutral-1000)] max-w-2xl mx-auto">
          The platform is AGPL-3.0. Nothing is behind a paywall. Support
          contracts fund development.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={
              "card-glass p-6 flex flex-col " +
              (t.highlight
                ? "border-2 border-[var(--color-brand-500)]"
                : "")
            }
          >
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="mt-3 text-3xl font-semibold">{t.price}</div>
            <p className="mt-2 text-sm text-[var(--color-neutral-1000)]">
              {t.description}
            </p>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check
                    size={14}
                    className="text-[var(--color-ok)] mt-0.5 shrink-0"
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={t.cta.href}
              className={
                "mt-6 inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-medium " +
                (t.highlight
                  ? "bg-[var(--color-brand-500)] text-white hover:brightness-110"
                  : "border border-[var(--color-border-strong)] hover:bg-white/[0.04]")
              }
            >
              {t.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
