import Link from "next/link";

import { AgentWizard } from "@/components/agent-wizard";
import { requireSession } from "@/lib/auth";

export default async function NewAgentPage() {
  await requireSession();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          Four quick steps. You can skip funding and payees — the only required
          step is a name.
        </p>
      </div>
      <AgentWizard />
    </div>
  );
}
