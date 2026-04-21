// SECURITY INVARIANT EXCEPTION:
//   The vocabulary ban forbids exposing addresses in the UI by default.
//   This endpoint is a narrow, opt-in exception: it returns a specific
//   agent's deposit address so the customer can fund that agent.
//   - Requires an authenticated session.
//   - Validates the agent belongs to the caller.
//   - Only called by <AgentDepositPanel> after an explicit "Reveal deposit
//     address" click.
//   - Does not render in any default UI path.

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent || agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ depositAddress: agent.accountAddress });
}
