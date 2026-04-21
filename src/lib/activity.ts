import "server-only";

import { formatUnits, parseAbiItem, type Address } from "viem";

import { USDC_ADDRESS, USDC_DECIMALS, arcPublic } from "./arc";
import { db } from "./db";

export type AgentActivityItem = {
  timestamp: number;
  direction: "in" | "out";
  counterpartyLabel: string;
  amountUsd: number;
};

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

type NormalizedActivity = {
  timestamp: number;
  direction: "in" | "out";
  counterpartyAddress: string;
  amountUsd: number;
};

async function getOnChainTransfers(
  accountAddress: Address,
  limit: number,
): Promise<NormalizedActivity[]> {
  if (USDC_ADDRESS === "0x0000000000000000000000000000000000000000") return [];
  try {
    const [outgoing, incoming] = await Promise.all([
      arcPublic.getLogs({
        address: USDC_ADDRESS,
        event: TRANSFER_EVENT,
        args: { from: accountAddress },
        fromBlock: "earliest",
        toBlock: "latest",
      }),
      arcPublic.getLogs({
        address: USDC_ADDRESS,
        event: TRANSFER_EVENT,
        args: { to: accountAddress },
        fromBlock: "earliest",
        toBlock: "latest",
      }),
    ]);
    const all: NormalizedActivity[] = [];
    for (const log of outgoing) {
      if (!log.args.value || !log.args.to) continue;
      const block = await arcPublic.getBlock({ blockHash: log.blockHash! });
      all.push({
        timestamp: Number(block.timestamp) * 1000,
        direction: "out",
        counterpartyAddress: log.args.to,
        amountUsd: Number(formatUnits(log.args.value, USDC_DECIMALS)),
      });
    }
    for (const log of incoming) {
      if (!log.args.value || !log.args.from) continue;
      const block = await arcPublic.getBlock({ blockHash: log.blockHash! });
      all.push({
        timestamp: Number(block.timestamp) * 1000,
        direction: "in",
        counterpartyAddress: log.args.from,
        amountUsd: Number(formatUnits(log.args.value, USDC_DECIMALS)),
      });
    }
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, limit);
  } catch (err) {
    console.warn("[activity] chain read failed:", err);
    return [];
  }
}

/**
 * Reads recent on-chain activity for an agent's account and resolves each
 * counterparty address into a user-visible label (via the Payee table) or
 * "External" as a fallback. Never returns addresses — strip happens here.
 */
export async function getAgentActivity(
  agentId: string,
  accountAddress: Address,
  limit = 25,
): Promise<AgentActivityItem[]> {
  const [raw, payees] = await Promise.all([
    getOnChainTransfers(accountAddress, limit),
    db.payee.findMany({ where: { agentId } }),
  ]);

  const byAddress = new Map<string, string>();
  for (const p of payees) {
    byAddress.set(p.address.toLowerCase(), p.label);
  }

  return raw.map((r) => ({
    timestamp: r.timestamp,
    direction: r.direction,
    counterpartyLabel:
      byAddress.get(r.counterpartyAddress.toLowerCase()) ?? "External",
    amountUsd: r.amountUsd,
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
