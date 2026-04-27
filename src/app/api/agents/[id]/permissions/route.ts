// SECURITY INVARIANT (see CLAUDE.md):
//   - Each Permission is a ZeroDev session key (ECDSA) installed on the
//     agent's Kernel, scoped by call + rate-limit policies.
//   - The session key's serialized permission account is encrypted at rest
//     with APP_ENCRYPTION_KEY. Raw private-key material is returned ONCE in
//     this response as `apiSecret` and never persisted in plaintext.

import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { z } from "zod";

import { zerodevConfigured } from "@/lib/chain";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encrypt, encryptionConfigured } from "@/lib/encryption";
import { installSessionKey } from "@/lib/kernel";

const schema = z.object({
  name: z.string().min(1).max(40),
  perPaymentLimitUsd: z.coerce.number().positive().max(1_000_000),
  monthlyLimitUsd: z.coerce.number().positive().max(1_000_000),
  payeeIds: z.array(z.string().min(1)).max(32),
  allowedOperations: z
    .array(z.enum(["send_payment", "approve_vendor", "receive_refund"]))
    .min(1)
    .max(3),
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
  if (agent.status !== "active") {
    return NextResponse.json(
      { error: `Can't add a permission to a ${agent.status} agent.` },
      { status: 409 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid permission", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.perPaymentLimitUsd > parsed.data.monthlyLimitUsd) {
    return NextResponse.json(
      { error: "Per-payment limit can't exceed monthly limit." },
      { status: 400 },
    );
  }

  const payees = await db.payee.findMany({
    where: { agentId: agent.id, id: { in: parsed.data.payeeIds } },
  });
  if (payees.length !== parsed.data.payeeIds.length) {
    return NextResponse.json(
      { error: "One or more payees don't belong to this agent." },
      { status: 400 },
    );
  }

  // transferFrom bypass mitigation: approve() with no payees = an agent that
  // could grant unlimited allowance to anyone.
  if (
    parsed.data.allowedOperations.includes("approve_vendor") &&
    payees.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Enabling vendor approvals requires at least one payee. Add a payee first or disable 'Approve vendor'.",
      },
      { status: 400 },
    );
  }

  if (!encryptionConfigured || !zerodevConfigured) {
    return NextResponse.json(
      { error: "Backend is not fully configured. Set APP_ENCRYPTION_KEY and ZERODEV_*." },
      { status: 503 },
    );
  }

  const ownerPk = decrypt(agent.ownerCiphertext) as Hex;

  let installed: Awaited<ReturnType<typeof installSessionKey>>;
  try {
    installed = await installSessionKey({
      ownerPrivateKey: ownerPk,
      scope: {
        perTxCapUsd: parsed.data.perPaymentLimitUsd,
        monthlyCapUsd: parsed.data.monthlyLimitUsd,
        allowedPayees: payees.map(
          (p) => p.address.toLowerCase() as `0x${string}`,
        ),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Couldn't install the permission on-chain: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 502 },
    );
  }

  const permission = await db.permission.create({
    data: {
      agentId: agent.id,
      name: parsed.data.name,
      sessionKeyId: installed.sessionKeyId,
      sessionKeyAddress: installed.sessionKeyAddress,
      sessionKeyCiphertext: encrypt(installed.serializedAccount),
      scope: JSON.stringify({
        perPaymentLimitUsd: parsed.data.perPaymentLimitUsd,
        monthlyLimitUsd: parsed.data.monthlyLimitUsd,
        payeeIds: parsed.data.payeeIds,
        allowedOperations: parsed.data.allowedOperations,
      }),
      status: "active",
      installTxHash: installed.installTxHash,
    },
  });

  return NextResponse.json({
    ok: true,
    permission: {
      id: permission.id,
      name: permission.name,
      status: "active",
      perPaymentLimitUsd: parsed.data.perPaymentLimitUsd,
      monthlyLimitUsd: parsed.data.monthlyLimitUsd,
      payeeIds: parsed.data.payeeIds,
      allowedOperations: parsed.data.allowedOperations,
    },
    // ⚠️ ONE-SHOT credentials. Never retrievable again.
    // The "API secret" is the session-key private key — the runtime client
    // uses it to authorize userOps through the installed permission plugin.
    credentials: {
      apiKeyId: permission.id,
      apiSecret: installed.sessionKeyPrivateKey,
      organizationId: session.id,
    },
  });
}
