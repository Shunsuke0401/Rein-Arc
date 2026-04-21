import { NextResponse } from "next/server";
import { z } from "zod";
import type { Address, Hex } from "viem";

import { zerodevConfigured } from "@/lib/arc";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encryptionConfigured } from "@/lib/encryption";
import { revokeSessionKey, sweepAgentUsdc } from "@/lib/kernel";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  sweepTo: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

export async function POST(req: Request, ctx: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { permissions: true },
  });
  if (!agent || agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (agent.status === "archived") {
    return NextResponse.json({ error: "Already archived." }, { status: 409 });
  }
  if (!encryptionConfigured || !zerodevConfigured) {
    return NextResponse.json(
      { error: "Backend is not fully configured." },
      { status: 503 },
    );
  }

  let sweepTo: string | undefined;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (parsed.success) sweepTo = parsed.data.sweepTo;
  }

  const ownerPk = decrypt(agent.ownerCiphertext) as Hex;

  // Revoke every active permission on-chain.
  for (const p of agent.permissions) {
    if (p.status !== "active") continue;
    try {
      const scope = JSON.parse(p.scope) as {
        perPaymentLimitUsd: number;
        monthlyLimitUsd: number;
      };
      const txHash = await revokeSessionKey({
        ownerPrivateKey: ownerPk,
        sessionKeyAddress: p.sessionKeyAddress as Address,
        scope: {
          perTxCapUsd: scope.perPaymentLimitUsd,
          monthlyCapUsd: scope.monthlyLimitUsd,
        },
      });
      await db.permission.update({
        where: { id: p.id },
        data: {
          status: "revoked",
          revokeTxHash: txHash,
          revokedAt: new Date(),
        },
      });
    } catch (err) {
      console.warn(
        `[archive] revoke failed for permission ${p.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Optional: sweep remaining balance to a customer-provided destination.
  if (sweepTo) {
    try {
      await sweepAgentUsdc({
        ownerPrivateKey: ownerPk,
        to: sweepTo as Address,
      });
    } catch (err) {
      console.warn("[archive] sweep failed:", err);
    }
  }

  await db.agent.update({
    where: { id: agent.id },
    data: { status: "archived", archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
