import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Github } from "lucide-react";
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
            <Github size={14} /> GitHub
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
