// SDK agent-status endpoint. Returns scoped view for the authenticated
// permission: name, balance, spent this month, caps, remaining monthly.

import { NextResponse } from "next/server";

import { summarizeAgent } from "@/lib/agents";
import { db } from "@/lib/db";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

export async function GET(req: Request) {
  const auth = await authenticateSdkRequest(req);
  if (!auth.ok) return auth.response;

  const agent = await db.agent.findUnique({
    where: { id: auth.permission.agentId },
  });
  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found.", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const scope = JSON.parse(auth.permission.scope) as {
    perPaymentLimitUsd: number;
    monthlyLimitUsd: number;
  };

  const summary = await summarizeAgent(agent);
  const remaining = Math.max(
    0,
    scope.monthlyLimitUsd - summary.spentThisMonthUsd,
  );

  return NextResponse.json({
    agent: {
      name: summary.name,
      balanceUsd: summary.balanceUsd,
      spentThisMonthUsd: summary.spentThisMonthUsd,
      perPaymentLimitUsd: scope.perPaymentLimitUsd,
      monthlyLimitUsd: scope.monthlyLimitUsd,
      remainingMonthlyUsd: remaining,
      status: summary.status,
    },
  });
}
