import Link from "next/link";
import { notFound } from "next/navigation";

import { PermissionForm } from "@/components/permission-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewPermissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { payees: { orderBy: { createdAt: "desc" } } },
  });
  if (!agent || agent.userId !== session.id) notFound();
  if (agent.status !== "active") notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={`/dashboard/agents/${agent.id}?tab=permissions`}
          className="text-sm text-neutral-600 hover:text-foreground"
        >
          ← Back to {agent.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New permission
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Issues a credential your agent runtime can use to make payments.
          Limits and payees are enforced in real time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>
            These limits are enforced every time your agent tries to move
            money. Tighten them whenever possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionForm
            agentId={agent.id}
            agentName={agent.name}
            payees={agent.payees.map((p) => ({ id: p.id, label: p.label }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
