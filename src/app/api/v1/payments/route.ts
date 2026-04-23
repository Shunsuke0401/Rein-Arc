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

  // `to` is a raw 0x address (validated by the zod schema above). We look up
  // a label for it ONLY for activity-log display — the authoritative recipient
  // check is the on-chain CallPolicy's ONE_OF, which pins the allowed
  // addresses when the permission was installed. Label lookup never decides
  // where the money goes.
  const recipient = parsed.data.to.toLowerCase() as Address;
  let counterpartyLabel = "External";
  if (scope.payeeIds?.length) {
    const match = await db.payee.findFirst({
      where: { id: { in: scope.payeeIds }, address: recipient },
      select: { label: true },
    });
    if (match) counterpartyLabel = match.label;
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
