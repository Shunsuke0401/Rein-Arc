"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { href: string; label: string; hint?: string }[] = [
  { href: "/docs", label: "Get Started" },
  { href: "/docs/api", label: "API Endpoints" },
  { href: "/docs/create-agent", label: "Create Agent", hint: "Coming soon" },
];

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="md:sticky md:top-20 md:self-start">
      <nav className="flex flex-col gap-0.5 text-sm">
        <div className="text-xs uppercase tracking-wider text-neutral-500 px-3 pb-2">
          Documentation
        </div>
        {SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={
                active
                  ? "flex items-center justify-between rounded-md bg-neutral-100 px-3 py-1.5 font-medium text-foreground"
                  : "flex items-center justify-between rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-50 hover:text-foreground"
              }
            >
              <span>{s.label}</span>
              {s.hint ? (
                <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                  {s.hint}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
