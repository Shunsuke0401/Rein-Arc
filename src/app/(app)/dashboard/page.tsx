import Link from "next/link";
import { ArrowRight, Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { summarizeAgent } from "@/lib/agents";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default async function DashboardPage() {
  const session = await requireSession();

  const rows = await db.agent.findMany({
    where: { userId: session.id, NOT: { status: "archived" } },
    orderBy: { createdAt: "desc" },
  });

  const agents = await Promise.all(rows.map((r) => summarizeAgent(r)));
  const totalAgentBalance = agents.reduce((acc, a) => acc + a.balanceUsd, 0);
  const totalSpent = agents.reduce((acc, a) => acc + a.spentThisMonthUsd, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {session.companyName}
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Give your AI agents a budget they can&rsquo;t exceed.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/new">
            <Plus className="h-4 w-4" /> New agent
          </Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total balance across agents</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatUsd(totalAgentBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active agents</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {agents.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent this month</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {formatUsd(totalSpent)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Recent agents
            </CardTitle>
            <CardDescription>
              Your three most recently created agents.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/agents">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-neutral-500">
              No agents yet.{" "}
              <Link
                href="/dashboard/agents/new"
                className="text-foreground hover:underline"
              >
                Create your first agent
              </Link>{" "}
              to set a budget and issue credentials to your runtime.
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {agents.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/agents/${a.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 text-sm"
                >
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-neutral-500">
                      {a.permissionCount} permission
                      {a.permissionCount === 1 ? "" : "s"} · Created{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="tabular-nums text-right">
                    <div className="font-medium">{formatUsd(a.balanceUsd)}</div>
                    <div className="text-xs text-neutral-500">
                      {formatUsd(a.spentThisMonthUsd)} this month
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
