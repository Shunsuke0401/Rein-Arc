import { NextResponse } from "next/server";

import { getAgentActivity } from "@/lib/activity";
import { summarizeAgent } from "@/lib/agents";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: {
      permissions: { orderBy: { createdAt: "desc" } },
      payees: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!agent || agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [summary, activity] = await Promise.all([
    summarizeAgent(agent),
    getAgentActivity(agent.id, 25),
  ]);

  return NextResponse.json({
    agent: {
      ...summary,
      permissions: agent.permissions.map((p) => {
        const scope = JSON.parse(p.scope) as {
          perPaymentLimitUsd: number;
          monthlyLimitUsd: number;
          payeeIds: string[];
          allowedOperations: string[];
        };
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          perPaymentLimitUsd: scope.perPaymentLimitUsd,
          monthlyLimitUsd: scope.monthlyLimitUsd,
          payeeIds: scope.payeeIds,
          allowedOperations: scope.allowedOperations,
          createdAt: p.createdAt.toISOString(),
        };
      }),
      payees: agent.payees.map((p) => ({
        id: p.id,
        label: p.label,
        createdAt: p.createdAt.toISOString(),
      })),
      recentActivity: activity,
    },
  });
}
