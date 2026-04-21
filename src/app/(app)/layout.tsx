import Link from "next/link";
import { LogOut } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-semibold text-lg">
              rein
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-neutral-600 hover:text-foreground"
              >
                Overview
              </Link>
              <Link
                href="/dashboard/agents"
                className="text-neutral-600 hover:text-foreground"
              >
                Agents
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-600">
            <div className="hidden sm:block">
              <div className="font-medium text-foreground">
                {session.companyName}
              </div>
              <div className="text-xs">{session.email}</div>
            </div>
            <LogoutButton>
              <LogOut className="h-4 w-4" />
            </LogoutButton>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
