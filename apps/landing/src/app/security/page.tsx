export default function SecurityPage() {
  return (
    <main className="container-p py-16 max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight mb-6">Security</h1>
      <p className="text-[var(--color-neutral-1000)] mb-6">
        We take security reports seriously. Please disclose vulnerabilities
        privately:
      </p>
      <ul className="space-y-2 mb-8">
        <li>
          Email: <a href="mailto:security@justmail.dev" className="underline">security@justmail.dev</a>
        </li>
        <li>GitHub advisory: use the &quot;Report a vulnerability&quot; tab on the repo.</li>
      </ul>
      <p className="text-[var(--color-neutral-1000)]">
        Details, PGP key, and safe-harbor commitments in{" "}
        <a
          href="https://github.com/justmaildev/justmail/blob/main/SECURITY.md"
          className="underline"
        >
          SECURITY.md
        </a>
        .
      </p>
    </main>
  );
}
