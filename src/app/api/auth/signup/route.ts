import { NextResponse } from "next/server";
import { z } from "zod";

import {
  clearChallenge,
  issueSession,
  readChallenge,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptionConfigured } from "@/lib/encryption";
import { verifyRegistration } from "@/lib/passkey";

const bodySchema = z.object({
  email: z.string().email().toLowerCase(),
  companyName: z.string().min(1).max(80),
  registrationResponse: z.unknown(),
});

export async function POST(req: Request) {
  if (!encryptionConfigured) {
    return NextResponse.json(
      { error: "APP_ENCRYPTION_KEY is not configured on the server." },
      { status: 503 },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, companyName, registrationResponse } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 },
    );
  }

  const challenge = await readChallenge("register");
  if (!challenge) {
    return NextResponse.json(
      { error: "Registration challenge expired. Start over." },
      { status: 400 },
    );
  }

  let verified: Awaited<ReturnType<typeof verifyRegistration>>;
  try {
    verified = await verifyRegistration({
      response: registrationResponse as Parameters<typeof verifyRegistration>[0]["response"],
      expectedChallenge: challenge,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Passkey registration failed: ${msg}` },
      { status: 400 },
    );
  }
  await clearChallenge("register");

  const user = await db.user.create({
    data: {
      email,
      companyName,
      passkeyCredentialId: verified.credentialId,
      passkeyPublicKey: verified.publicKey,
      passkeyCounter: verified.counter,
    },
  });
  await issueSession(user.id);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      companyName: user.companyName,
    },
  });
}
