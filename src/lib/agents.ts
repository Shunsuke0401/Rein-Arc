import "server-only";

import { formatUnits, type Address } from "viem";

import { STABLE_DECIMALS, getStableBalance } from "./chain";
import { getAgentSpentThisMonth } from "./activity";
import { db } from "./db";

export type AgentSummary = {
  id: string;
  name: string;
  balanceUsd: number;
  spentThisMonthUsd: number;
  status: string;
  createdAt: string;
  permissionCount: number;
};

export async function summarizeAgent(agent: {
  id: string;
  name: string;
  accountAddress: string;
  status: string;
  createdAt: Date;
}): Promise<AgentSummary> {
  const [balanceRaw, spent, permissionCount] = await Promise.all([
    getStableBalance(agent.accountAddress as Address),
    getAgentSpentThisMonth(agent.id),
    db.permission.count({
      where: { agentId: agent.id, status: "active" },
    }),
  ]);

  return {
    id: agent.id,
    name: agent.name,
    balanceUsd: Number(formatUnits(balanceRaw, STABLE_DECIMALS)),
    spentThisMonthUsd: spent,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    permissionCount,
  };
}
