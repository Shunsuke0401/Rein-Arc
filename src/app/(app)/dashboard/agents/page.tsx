import Link from "next/link";
import { Plus } from "lucide-react";

import { AgentList } from "@/components/agent-list";
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

export default async function AgentsPage() {
  const session = await requireSession();
  const rows = await db.agent.findMany({
    where: { userId: session.id, NOT: { status: "archived" } },
    orderBy: { createdAt: "desc" },
  });
  const agents = await Promise.all(rows.map((r) => summarizeAgent(r)));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Each agent has its own balance and its own scoped credentials.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/new">
            <Plus className="h-4 w-4" /> New agent
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No agents yet</CardTitle>
            <CardDescription>
              Create an agent, set its budget, and issue a scoped credential to
              your runtime. Rein enforces every payment in real time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/agents/new">
                <Plus className="h-4 w-4" /> Create first agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AgentList agents={agents} />
      )}
    </div>
  );
}
