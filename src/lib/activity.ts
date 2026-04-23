import "server-only";

import { db } from "./db";

export type AgentActivityItem = {
  timestamp: number;
  direction: "in" | "out";
  counterpartyLabel: string;
  amountUsd: number;
  status: "pending" | "confirmed" | "failed";
};

// Reads recent payment activity from the Transaction table, where the
// /api/v1/payments route writes a row on every attempt (pending → confirmed
// or failed). Previously this read on-chain USDC Transfer logs, which was
// brittle against public-RPC rate limits and broad `fromBlock: earliest`
// queries — and silently returned [] when the call failed. Incoming direct
// deposits (via the Deposit tab) do not currently create a Transaction row
// and therefore don't appear here; the Balance card already reflects them
// via an on-chain balanceOf read.
export async function getAgentActivity(
  agentId: string,
  limit = 25,
): Promise<AgentActivityItem[]> {
  const rows = await db.transaction.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    timestamp: r.createdAt.getTime(),
    direction: r.direction as "in" | "out",
    counterpartyLabel: r.payeeLabel ?? "External",
    amountUsd: r.amountUsd,
    status: r.status as "pending" | "confirmed" | "failed",
  }));
}

export async function getAgentSpentThisMonth(
  agentId: string,
): Promise<number> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await db.transaction.findMany({
    where: {
      agentId,
      direction: "out",
      status: { in: ["pending", "confirmed"] },
      createdAt: { gte: since },
    },
  });
  return rows.reduce((acc, r) => acc + r.amountUsd, 0);
}
