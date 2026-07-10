export default function ChangelogPage() {
  return (
    <main className="container-p py-16 max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight mb-6">Changelog</h1>
      <p className="text-[var(--color-neutral-1000)] mb-10">
        Every release is captured in{" "}
        <a
          href="https://github.com/justmaildev/justmail/blob/main/CHANGELOG.md"
          className="underline"
        >
          CHANGELOG.md
        </a>
        .
      </p>
      <article className="prose prose-invert max-w-none">
        <h2>1.0.0-alpha.1</h2>
        <p className="text-sm text-[var(--color-neutral-900)]">Unreleased</p>
        <ul>
          <li>
            <strong>Foundation:</strong> monorepo split into admin, webmail,
            landing, api apps and 10 shared packages.
          </li>
          <li>
            <strong>Contracts:</strong> single-source-of-truth zod schemas and
            OpenAPI-generated spec.
          </li>
          <li>
            <strong>Design system:</strong> tokens + primitives, dark/light/high
            contrast themes.
          </li>
          <li>
            <strong>Docs:</strong> full{" "}
            <code>docs/redesign/</code> planning suite published.
          </li>
        </ul>
      </article>
    </main>
  );
}
