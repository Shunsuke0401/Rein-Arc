import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";

import { zerodevConfigured } from "@/lib/arc";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encryptionConfigured } from "@/lib/encryption";
import { revokeSessionKey } from "@/lib/kernel";

type Params = { params: Promise<{ id: string; permId: string }> };

export async function POST(_req: Request, ctx: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, permId } = await ctx.params;
  const permission = await db.permission.findUnique({
    where: { id: permId },
    include: { agent: true },
  });
  if (!permission || permission.agentId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (permission.agent.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (permission.status !== "active") {
    return NextResponse.json(
      { error: `Permission is already ${permission.status}.` },
      { status: 409 },
    );
  }
  if (!encryptionConfigured || !zerodevConfigured) {
    return NextResponse.json(
      { error: "Backend is not fully configured." },
      { status: 503 },
    );
  }

  try {
    const ownerPk = decrypt(permission.agent.ownerCiphertext) as Hex;
    const scope = JSON.parse(permission.scope) as {
      perPaymentLimitUsd: number;
      monthlyLimitUsd: number;
      payeeIds?: string[];
    };
    const payees = scope.payeeIds?.length
      ? await db.payee.findMany({
          where: { id: { in: scope.payeeIds } },
          select: { address: true },
        })
      : [];
    const txHash = await revokeSessionKey({
      ownerPrivateKey: ownerPk,
      sessionKeyAddress: permission.sessionKeyAddress as Address,
      scope: {
        perTxCapUsd: scope.perPaymentLimitUsd,
        monthlyCapUsd: scope.monthlyLimitUsd,
        allowedPayees: payees.map(
          (p) => p.address.toLowerCase() as `0x${string}`,
        ),
      },
    });
    await db.permission.update({
      where: { id: permission.id },
      data: {
        status: "revoked",
        revokeTxHash: txHash,
        revokedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Revoke failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 502 },
    );
  }
}
