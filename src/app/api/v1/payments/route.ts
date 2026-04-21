// Rein SDK payment endpoint. Bearer-authenticated version of /api/payments.
// Accepts:
//   Authorization: Bearer rein_<permissionId>_<sessionKeyPrivateKeyHex>
//   Body: { to: "<payee label> | 0x…", amountUsd: number, note?: string }

import { NextResponse } from "next/server";
import { isAddress, type Address, type Hex } from "viem";
import { z } from "zod";

import { db } from "@/lib/db";
import { decrypt, encryptionConfigured } from "@/lib/encryption";
import { sendUsdcFromSessionKey } from "@/lib/kernel";
import { authenticateSdkRequest } from "@/lib/sdk-auth";

const body = z.object({
  to: z.string().min(1),
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

  // Resolve `to` — either a label against the permission's saved payees
  // or a raw address (open-mode).
  let recipient: Address | undefined;
  let counterpartyLabel: string = "External";

  if (isAddress(parsed.data.to)) {
    recipient = parsed.data.to as Address;
    // If we have a label for this address, use it.
    if (scope.payeeIds?.length) {
      const match = await db.payee.findFirst({
        where: {
          id: { in: scope.payeeIds },
          address: parsed.data.to.toLowerCase(),
        },
        select: { label: true },
      });
      if (match) counterpartyLabel = match.label;
    }
  } else if (scope.payeeIds?.length) {
    const match = await db.payee.findFirst({
      where: {
        id: { in: scope.payeeIds },
        label: parsed.data.to,
      },
      select: { address: true, label: true },
    });
    if (!match) {
      return NextResponse.json(
        {
          error: `No payee named "${parsed.data.to}" on this permission.`,
          code: "PAYEE_NOT_ALLOWED",
        },
        { status: 403 },
      );
    }
    recipient = match.address as Address;
    counterpartyLabel = match.label;
  } else {
    return NextResponse.json(
      {
        error:
          "`to` must be a 0x-address when the permission has no saved payees.",
        code: "PAYEE_NOT_ALLOWED",
      },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: `Payment rejected: ${msg}`, code: "PERMISSION_CAP_EXCEEDED" },
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
