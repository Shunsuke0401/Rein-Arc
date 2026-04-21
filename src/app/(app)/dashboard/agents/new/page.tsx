import Link from "next/link";

import { AgentForm } from "@/components/agent-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth";

export default async function NewAgentPage() {
  await requireSession();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-sm text-neutral-600 hover:text-foreground"
        >
          ← All agents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Create a new agent
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Configure the agent&rsquo;s spending caps and payees. You&rsquo;ll get
          a one-shot API key right after — save it before closing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>
            The agent gets its own balance, scoped spending caps, and a
            one-shot API key. Fund it directly on the next page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentForm />
        </CardContent>
      </Card>
    </div>
  );
}
