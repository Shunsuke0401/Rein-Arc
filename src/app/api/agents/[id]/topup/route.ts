// Mock fiat on-ramp. In production this becomes a Stripe / Circle call; here
// a Rein-operated EOA (pre-funded at https://faucet.circle.com) transfers
// USDC to the agent's Kernel, simulating a card / bank top-up.

import { NextResponse } from "next/server";
import type { Address } from "viem";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { onrampConfigured, sendMockFiatTopup } from "@/lib/onramp";

const body = z.object({
  amountUsd: z.coerce.number().positive().max(10_000),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent || agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (!onrampConfigured()) {
    return NextResponse.json(
      { error: "Top-up is not configured. Set REIN_ONRAMP_FUNDER_PRIVATE_KEY." },
      { status: 503 },
    );
  }

  try {
    const result = await sendMockFiatTopup({
      to: agent.accountAddress as Address,
      amountUsd: parsed.data.amountUsd,
    });
    await db.transaction.create({
      data: {
        agentId: agent.id,
        amountUsd: parsed.data.amountUsd,
        direction: "in",
        status: "confirmed",
        txHash: result.txHash,
        payeeLabel: "Top up",
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Top-up failed: ${msg}` },
      { status: 502 },
    );
  }
}
