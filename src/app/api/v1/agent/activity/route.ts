// SDK activity endpoint. Returns recent payment activity for the agent
// behind this permission. Labels and amounts only — no hashes, no addresses.

import { NextResponse } from "next/server";

import { getAgentActivity } from "@/lib/activity";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

export async function GET(req: Request) {
  const auth = await authenticateSdkRequest(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "10");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 10));

  const items = await getAgentActivity(auth.permission.agentId, limit);

  return NextResponse.json({
    activity: items.map((it) => ({
      timestamp: new Date(it.timestamp).toISOString(),
      direction: it.direction,
      counterpartyLabel: it.counterpartyLabel,
      amountUsd: it.amountUsd,
      status: it.status,
    })),
  });
}
