import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { surfaceDark } from "@justmail/design-tokens";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "JustMail — self-hosted mail platform",
    template: "%s · JustMail",
  },
  description:
    "The mail server you actually want to run. Self-hosted, open source, deliverability-first, with a modern control plane.",
  metadataBase: new URL("https://justmail.dev"),
  openGraph: {
    title: "JustMail",
    description: "Self-hosted mail platform.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: surfaceDark.bg,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <body>
        <TopNav />
        {children}
        <Footer />
      </body>
    </html>
  );
}

function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-40 bg-[color:color-mix(in_oklab,_var(--color-bg)_70%,_transparent)] backdrop-blur border-b border-[var(--color-border)]">
      <div className="container-p flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block w-7 h-7 rounded-lg bg-[var(--color-brand-500)] grid place-items-center text-white">
            J
          </span>
          JustMail
        </Link>
        <nav className="flex items-center gap-6 text-sm text-[var(--color-neutral-1000)]">
          <Link href="/features">Features</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/changelog">Changelog</Link>
          <a
            href="https://github.com/justmaildev/justmail"
            className="flex items-center gap-1"
          >
            <GithubMark size={14} /> GitHub
          </a>
          <Link
            href="/download"
            className="px-3 py-1.5 rounded-md bg-[var(--color-brand-500)] text-white font-medium hover:brightness-110"
          >
            Install
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-24">
      <div className="container-p py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-semibold mb-3">Product</div>
          <ul className="space-y-2 text-[var(--color-neutral-1000)]">
            <li><Link href="/features">Features</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/changelog">Changelog</Link></li>
            <li><Link href="/security">Security</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Develop</div>
          <ul className="space-y-2 text-[var(--color-neutral-1000)]">
            <li><Link href="/docs">Docs</Link></li>
            <li><Link href="/docs/latest/api">API reference</Link></li>
            <li><Link href="/docs/latest/plugin-development">Plugins</Link></li>
            <li><a href="https://github.com/justmaildev/justmail">GitHub</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Community</div>
          <ul className="space-y-2 text-[var(--color-neutral-1000)]">
            <li><a href="https://github.com/justmaildev/justmail/discussions">Discussions</a></li>
            <li><Link href="/community">Chat</Link></li>
            <li><Link href="/blog">Blog</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-[var(--color-neutral-1000)]">
            <li><Link href="/about">About</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-p pb-8 text-xs text-[var(--color-neutral-800)] flex items-center justify-between">
        <div>© {new Date().getFullYear()} JustMail contributors. AGPL-3.0.</div>
        <div>The mail server you actually want to run.</div>
      </div>
    </footer>
  );
}
