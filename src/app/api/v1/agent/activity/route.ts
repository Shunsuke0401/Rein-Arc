// SDK activity endpoint. Returns recent payment activity for the agent
// behind this permission. Labels and amounts only — no hashes, no addresses.

import { NextResponse } from "next/server";

import type { Address } from "viem";

import { getAgentActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

export async function GET(req: Request) {
  const auth = await authenticateSdkRequest(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "10");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 10));

  const agent = await db.agent.findUnique({
    where: { id: auth.permission.agentId },
    select: { accountAddress: true },
  });
  if (!agent) {
    return new Response(
      JSON.stringify({ error: "Agent not found.", code: "NOT_FOUND" }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  const items = await getAgentActivity(
    auth.permission.agentId,
    agent.accountAddress as Address,
    limit,
  );

  return NextResponse.json({
    activity: items.map((it) => ({
      timestamp: new Date(it.timestamp * 1000).toISOString(),
      direction: it.direction,
      counterpartyLabel: it.counterpartyLabel,
      amountUsd: it.amountUsd,
      status: "confirmed" as const,
    })),
  });
}
