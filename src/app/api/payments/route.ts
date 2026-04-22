// Runtime demo endpoint — how the agent actually spends.
//
// The caller presents { apiKeyId (= permission id), apiSecret (= session key
// private key), payeeId OR to, amountUsd }. We:
//   1. Look up the permission + its encrypted serialized permission-account.
//   2. Decrypt, re-hydrate the session-key account via deserializePermissionAccount.
//      (We do NOT trust the raw session-key material client-side; we re-sign
//      server-side against the serialized account that already knows the
//      policies it's been scoped to.)
//   3. Send a USDC transfer userOp. The ZeroDev bundler + permission plugin
//      enforce the per-tx cap on-chain. If it's over, the bundler rejects.

import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import { z } from "zod";

import { db } from "@/lib/db";
import { decrypt, encryptionConfigured } from "@/lib/encryption";
import { sendUsdcFromSessionKey } from "@/lib/kernel";

const body = z.object({
  apiKeyId: z.string().min(1).optional(),
  apiSecret: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  payeeId: z.string().min(1).optional(),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  amountUsd: z.coerce.number().positive().max(1_000_000),
});

function unpackBearer(
  header: string | null,
): { apiKeyId: string; apiSecret: `0x${string}` } | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith("rein_")) return null;
  const rest = token.slice("rein_".length);
  const i = rest.indexOf("_");
  if (i < 1) return null;
  const apiKeyId = rest.slice(0, i);
  const hex = rest.slice(i + 1);
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return { apiKeyId, apiSecret: `0x${hex}` as `0x${string}` };
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Prefer Authorization: Bearer rein_<id>_<hex>, fall back to legacy body fields.
  const bearer = unpackBearer(req.headers.get("authorization"));
  const apiKeyId = bearer?.apiKeyId ?? parsed.data.apiKeyId;
  const apiSecret = bearer?.apiSecret ?? (parsed.data.apiSecret as `0x${string}` | undefined);
  if (!apiKeyId || !apiSecret) {
    return NextResponse.json(
      { error: "Provide Authorization: Bearer <REIN_API_KEY> or apiKeyId+apiSecret in body." },
      { status: 401 },
    );
  }
  if (!encryptionConfigured) {
    return NextResponse.json(
      { error: "Backend not configured." },
      { status: 503 },
    );
  }

  const permission = await db.permission.findUnique({
    where: { id: apiKeyId },
    include: { agent: true },
  });
  if (
    !permission ||
    permission.status !== "active" ||
    !permission.sessionKeyCiphertext
  ) {
    return NextResponse.json(
      { error: "Unknown or revoked API key." },
      { status: 401 },
    );
  }

  const scope = JSON.parse(permission.scope) as {
    perPaymentLimitUsd: number;
    monthlyLimitUsd: number;
    payeeIds?: string[];
  };

  let recipient: Address | undefined;
  let payeeLabel: string | undefined;
  if (parsed.data.payeeId) {
    const payee = await db.payee.findUnique({
      where: { id: parsed.data.payeeId },
    });
    if (!payee || payee.agentId !== permission.agentId) {
      return NextResponse.json(
        { error: "Unknown payee for this permission." },
        { status: 400 },
      );
    }
    recipient = payee.address as Address;
    payeeLabel = payee.label;
  } else if (parsed.data.to) {
    recipient = parsed.data.to as Address;
  } else {
    return NextResponse.json(
      { error: "Either payeeId or to is required." },
      { status: 400 },
    );
  }

  // Resolve the recipient label from the agent's saved payees (if any) for
  // nicer activity log entries. The authoritative payee allow-list lives in
  // the on-chain CallPolicy (via ParamCondition.ONE_OF) — a non-allowlisted
  // recipient causes the bundler to reject the userOp.
  if (!payeeLabel && scope.payeeIds?.length) {
    const match = await db.payee.findFirst({
      where: {
        id: { in: scope.payeeIds },
        address: (recipient as string).toLowerCase(),
      },
      select: { label: true },
    });
    if (match) payeeLabel = match.label;
  }

  if (parsed.data.amountUsd > scope.perPaymentLimitUsd) {
    return NextResponse.json(
      { error: "Amount exceeds this permission's per-payment limit." },
      { status: 403 },
    );
  }

  const serialized = decrypt(permission.sessionKeyCiphertext);
  let result: Awaited<ReturnType<typeof sendUsdcFromSessionKey>>;
  try {
    result = await sendUsdcFromSessionKey({
      serializedSessionKeyAccount: serialized,
      sessionKeyPrivateKey: apiSecret as Hex,
      to: recipient,
      amountUsd: parsed.data.amountUsd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // On-chain policy rejection surfaces here. Record as failed.
    await db.transaction.create({
      data: {
        agentId: permission.agentId,
        permissionId: permission.id,
        payeeLabel: payeeLabel ?? "External",
        amountUsd: parsed.data.amountUsd,
        direction: "out",
        status: "failed",
      },
    });
    return NextResponse.json(
      { error: `Payment rejected: ${msg}` },
      { status: 403 },
    );
  }

  await db.transaction.create({
    data: {
      agentId: permission.agentId,
      permissionId: permission.id,
      payeeLabel: payeeLabel ?? "External",
      amountUsd: parsed.data.amountUsd,
      direction: "out",
      status: "confirmed",
      txHash: result.txHash as Hex,
    },
  });

  return NextResponse.json({
    ok: true,
    amountUsd: parsed.data.amountUsd,
    payee: payeeLabel ?? "External",
  });
}
