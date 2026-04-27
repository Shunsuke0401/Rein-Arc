// Rein SDK payment endpoint. Bearer-authenticated version of /api/payments.
// Accepts:
//   Authorization: Bearer rein_<permissionId>_<sessionKeyPrivateKeyHex>
//   Body: { to: "<payee label> | 0x…", amountUsd: number, note?: string }

import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import { z } from "zod";

import { db } from "@/lib/db";
import { decrypt, encryptionConfigured } from "@/lib/encryption";
import { sendUsdcFromSessionKey } from "@/lib/kernel";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

const body = z.object({
  to: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "`to` must be a 0x-address (40 hex chars)."),
  amountUsd: z.coerce.number().positive().max(1_000_000),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await authenticateSdkRequest(req);
  if (!auth.ok) return auth.response;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "INTERNAL" },
      { status: 400 },
    );
  }
  if (!encryptionConfigured) {
    return NextResponse.json(
      { error: "Backend not configured.", code: "INTERNAL" },
      { status: 503 },
    );
  }

  const { permission } = auth;
  if (!permission.sessionKeyCiphertext) {
    return NextResponse.json(
      { error: "Permission missing session key.", code: "INVALID_API_KEY" },
      { status: 401 },
    );
  }

  const scope = JSON.parse(permission.scope) as {
    perPaymentLimitUsd: number;
    monthlyLimitUsd: number;
    payeeIds?: string[];
  };

  // The on-chain CallPolicy's ONE_OF is the authoritative recipient
  // enforcement; this app-layer check only exists so a non-allowed payee
  // gets a clean PAYEE_NOT_ALLOWED instead of an AA23 revert from the bundler
  // (and so we don't leak RPC/userOp internals in the error body).
  //
  // Compare addresses case-insensitively in JS — historical payee rows were
  // stored checksummed, and SQLite/Postgres string equality is case-sensitive.
  // New rows are written lowercase (see /api/agents/[id]/payees), so this
  // shim is only needed until all legacy rows are normalized.
  const recipient = parsed.data.to.toLowerCase() as Address;
  let counterpartyLabel = "External";
  if (scope.payeeIds?.length) {
    const candidates = await db.payee.findMany({
      where: { id: { in: scope.payeeIds } },
      select: { label: true, address: true },
    });
    const match = candidates.find((p) => p.address.toLowerCase() === recipient);
    if (!match) {
      return NextResponse.json(
        {
          error: "Recipient is not on this permission's payee allow-list.",
          code: "PAYEE_NOT_ALLOWED",
        },
        { status: 403 },
      );
    }
    counterpartyLabel = match.label;
  }

  if (parsed.data.amountUsd > scope.perPaymentLimitUsd) {
    return NextResponse.json(
      {
        error: "Amount exceeds this permission's per-payment limit.",
        code: "PERMISSION_CAP_EXCEEDED",
      },
      { status: 403 },
    );
  }

  const serialized = decrypt(permission.sessionKeyCiphertext);
  let result: Awaited<ReturnType<typeof sendUsdcFromSessionKey>>;
  try {
    result = await sendUsdcFromSessionKey({
      serializedSessionKeyAccount: serialized,
      sessionKeyPrivateKey: auth.apiSecret as Hex,
      to: recipient,
      amountUsd: parsed.data.amountUsd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Keep raw RPC/userOp/chain detail server-side only — never send to
    // clients. Leaking these would expose the ZeroDev project ID (grief
    // target), the agent's smart-account address (CLAUDE.md invariant #5),
    // and internal vocabulary (invariant #1).
    console.error("[/api/v1/payments] userOp rejected:", msg);
    await db.transaction.create({
      data: {
        agentId: permission.agentId,
        permissionId: permission.id,
        payeeLabel: counterpartyLabel,
        amountUsd: parsed.data.amountUsd,
        direction: "out",
        status: "failed",
      },
    });
    // Distinguish "another userOp with the same nonce is still pending"
    // from a real on-chain rejection. Both surface as exceptions from the
    // bundler, but the recovery is completely different: the former just
    // needs the caller to wait, while the latter means caps/policies are
    // violated. Returning PERMISSION_CAP_EXCEEDED for both is misleading
    // and triggers wrong retry behavior in SDK consumers.
    if (
      /Already known|replacement transaction underpriced|AA25/i.test(msg)
    ) {
      return NextResponse.json(
        {
          error:
            "A previous payment is still being processed. Wait ~30s and try again.",
          code: "PAYMENT_IN_FLIGHT",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      {
        error: "Payment rejected by on-chain policy.",
        code: "PERMISSION_CAP_EXCEEDED",
      },
      { status: 403 },
    );
  }

  const tx = await db.transaction.create({
    data: {
      agentId: permission.agentId,
      permissionId: permission.id,
      payeeLabel: counterpartyLabel,
      amountUsd: parsed.data.amountUsd,
      direction: "out",
      status: "confirmed",
      txHash: result.txHash as Hex,
    },
  });

  return NextResponse.json({
    ok: true,
    payment: {
      id: tx.id,
      status: "confirmed",
      amountUsd: parsed.data.amountUsd,
      to: counterpartyLabel,
      createdAt: tx.createdAt.toISOString(),
    },
  });
}
