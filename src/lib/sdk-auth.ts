import "server-only";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// SDK callers authenticate with a single Bearer token of the form
//   rein_<permissionId>_<sessionKeyPrivateKey>
// That's a simple, reversible packing of the two pieces of credential we
// already issue at permission creation: the permission id and the session-key
// private key. No DB migration needed — we look up the permission by id and
// treat the second half as the signing material on /api/v1/payments.

export type SdkAuthResult =
  | { ok: true; apiKeyId: string; apiSecret: `0x${string}`; permission: {
      id: string;
      agentId: string;
      status: string;
      scope: string;
      sessionKeyCiphertext: string | null;
      agent: { accountAddress: string };
    } }
  | { ok: false; response: Response };

export function packApiKey(apiKeyId: string, apiSecret: string): string {
  const secret = apiSecret.startsWith("0x") ? apiSecret.slice(2) : apiSecret;
  return `rein_${apiKeyId}_${secret}`;
}

function unpackApiKey(token: string): { apiKeyId: string; apiSecret: `0x${string}` } | null {
  if (!token.startsWith("rein_")) return null;
  const rest = token.slice("rein_".length);
  // apiKeyId is a cuid (letters+digits, no underscores). Split on the FIRST
  // underscore: left is permission id, right is the hex-encoded secret.
  const underscoreIdx = rest.indexOf("_");
  if (underscoreIdx < 1) return null;
  const apiKeyId = rest.slice(0, underscoreIdx);
  const secretHex = rest.slice(underscoreIdx + 1);
  if (!/^[0-9a-fA-F]{64}$/.test(secretHex)) return null;
  return { apiKeyId, apiSecret: `0x${secretHex}` as `0x${string}` };
}

export async function authenticateSdkRequest(
  req: Request,
): Promise<SdkAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing Bearer token.", code: "INVALID_API_KEY" },
        { status: 401 },
      ),
    };
  }
  const unpacked = unpackApiKey(match[1].trim());
  if (!unpacked) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Malformed API key.", code: "INVALID_API_KEY" },
        { status: 401 },
      ),
    };
  }

  const permission = await db.permission.findUnique({
    where: { id: unpacked.apiKeyId },
    select: {
      id: true,
      agentId: true,
      status: true,
      scope: true,
      sessionKeyCiphertext: true,
      agent: { select: { accountAddress: true } },
    },
  });
  if (!permission || permission.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unknown or revoked API key.", code: "INVALID_API_KEY" },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    apiKeyId: unpacked.apiKeyId,
    apiSecret: unpacked.apiSecret,
    permission,
  };
}
