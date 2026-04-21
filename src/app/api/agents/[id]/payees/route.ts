import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const body = z.object({
  label: z.string().min(1).max(60),
  address: z
    .string()
    .refine((v) => isAddress(v), { message: "Invalid address" })
    .transform((v) => v as Address),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent || agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payee", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payee = await db.payee.create({
    data: {
      agentId: agent.id,
      label: parsed.data.label,
      address: parsed.data.address,
    },
  });

  // Return the label but NOT the address. The UI must never see addresses
  // after creation.
  return NextResponse.json({
    ok: true,
    payee: { id: payee.id, label: payee.label, createdAt: payee.createdAt.toISOString() },
  });
}
