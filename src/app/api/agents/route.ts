// SECURITY INVARIANT:
//   - Every agent is a fresh ZeroDev Kernel v3 on Arc with a unique ECDSA
//     sudo-owner key generated and encrypted server-side (APP_ENCRYPTION_KEY).
//   - Agents are created empty. The customer funds each agent directly from
//     the funding modal (fiat on-ramp or crypto deposit). There is NO
//     Company-level balance pool.
//   - Gas is sponsored by the ZeroDev paymaster — agents never touch gas.

import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { z } from "zod";

import { summarizeAgent } from "@/lib/agents";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt, encrypt, encryptionConfigured } from "@/lib/encryption";
import {
  computeKernelAddress,
  generateAgentOwnerPrivateKey,
  installSessionKey,
} from "@/lib/kernel";
import { zerodevConfigured } from "@/lib/arc";

const payeeInput = z.object({
  label: z.string().min(1).max(40),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid address"),
});

const createAgentSchema = z.object({
  name: z.string().min(1).max(40),
  perPaymentLimitUsd: z.coerce.number().positive().max(1_000_000),
  monthlyLimitUsd: z.coerce.number().positive().max(1_000_000),
  payees: z.array(payeeInput).max(32).default([]),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.agent.findMany({
    where: { userId: session.id, NOT: { status: "archived" } },
    orderBy: { createdAt: "desc" },
  });

  const agents = await Promise.all(rows.map((r) => summarizeAgent(r)));
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createAgentSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!encryptionConfigured) {
    return NextResponse.json(
      { error: "APP_ENCRYPTION_KEY is not configured on the server." },
      { status: 503 },
    );
  }
  if (!zerodevConfigured) {
    return NextResponse.json(
      { error: "ZeroDev is not configured. Set ZERODEV_* env vars." },
      { status: 503 },
    );
  }

  if (parsed.data.perPaymentLimitUsd > parsed.data.monthlyLimitUsd) {
    return NextResponse.json(
      { error: "Per-payment limit can't exceed monthly limit." },
      { status: 400 },
    );
  }

  const ownerPk = generateAgentOwnerPrivateKey();
  let accountAddress: string;
  try {
    accountAddress = await computeKernelAddress(ownerPk);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Couldn't derive Kernel address: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 502 },
    );
  }

  const agent = await db.agent.create({
    data: {
      userId: session.id,
      name: parsed.data.name,
      accountAddress,
      ownerCiphertext: encrypt(ownerPk),
      status: "active",
    },
  });

  const createdPayees = parsed.data.payees.length
    ? await Promise.all(
        parsed.data.payees.map((p) =>
          db.payee.create({
            data: { agentId: agent.id, label: p.label, address: p.address.toLowerCase() },
          }),
        ),
      )
    : [];

  let installed: Awaited<ReturnType<typeof installSessionKey>>;
  try {
    installed = await installSessionKey({
      ownerPrivateKey: decrypt(agent.ownerCiphertext) as Hex,
      scope: {
        perTxCapUsd: parsed.data.perPaymentLimitUsd,
        monthlyCapUsd: parsed.data.monthlyLimitUsd,
        allowedPayees: createdPayees.map(
          (p) => p.address.toLowerCase() as `0x${string}`,
        ),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Couldn't install the agent's key on-chain: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      },
      { status: 502 },
    );
  }

  const permission = await db.permission.create({
    data: {
      agentId: agent.id,
      name: `${parsed.data.name} key`,
      sessionKeyId: installed.sessionKeyId,
      sessionKeyAddress: installed.sessionKeyAddress,
      sessionKeyCiphertext: encrypt(installed.serializedAccount),
      scope: JSON.stringify({
        perPaymentLimitUsd: parsed.data.perPaymentLimitUsd,
        monthlyLimitUsd: parsed.data.monthlyLimitUsd,
        payeeIds: createdPayees.map((p) => p.id),
        allowedOperations: ["send_payment"],
      }),
      status: "active",
      installTxHash: installed.installTxHash,
    },
  });

  const summary = await summarizeAgent(agent);
  return NextResponse.json({
    ok: true,
    agent: summary,
    payees: createdPayees.map((p) => ({ id: p.id, label: p.label })),
    // ⚠️ ONE-SHOT credentials. Never retrievable again.
    credentials: {
      apiKeyId: permission.id,
      apiSecret: installed.sessionKeyPrivateKey,
      organizationId: session.id,
    },
  });
}
