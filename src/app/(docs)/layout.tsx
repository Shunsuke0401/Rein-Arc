import Link from "next/link";

import { DocsSidebar } from "@/components/docs-sidebar";

// Public docs layout — no auth wrapper.
// Matches the marketing/dashboard header look with the Docs pill active.

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            rein
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="text-neutral-600 hover:text-foreground">
              Home
            </Link>
            <Link
              href="/docs"
              className="rounded-full bg-foreground text-background px-3 py-1 font-medium"
            >
              Docs
            </Link>
            <a
              href="https://www.npmjs.com/package/rein-sdk"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-600 hover:text-foreground"
            >
              npm
            </a>
            <a
              href="https://github.com/Shunsuke0401/Rein-Arc"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-600 hover:text-foreground"
            >
              GitHub
            </a>
            <Link
              href="/dashboard"
              className="text-neutral-600 hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-6 py-10 flex-1 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-10">
        <DocsSidebar />
        <main className="max-w-3xl min-w-0">{children}</main>
      </div>

      <footer className="border-t bg-neutral-50 mt-10">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-neutral-500 flex flex-wrap items-center gap-4 justify-between">
          <div>Built on Arc with ZeroDev Kernel v3 smart accounts.</div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground">
              rein.dev
            </Link>
            <a
              href="https://github.com/Shunsuke0401/Rein-Arc"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
