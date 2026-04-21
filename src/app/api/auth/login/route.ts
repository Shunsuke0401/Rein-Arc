import { NextResponse } from "next/server";
import { z } from "zod";

import { clearChallenge, issueSession, readChallenge } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyAssertion } from "@/lib/passkey";

const bodySchema = z.object({
  email: z.string().email().toLowerCase(),
  authenticationResponse: z.unknown(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, authenticationResponse } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No matching account." }, { status: 404 });
  }

  const challenge = await readChallenge("authenticate");
  if (!challenge) {
    return NextResponse.json(
      { error: "Sign-in challenge expired. Try again." },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof verifyAssertion>>;
  try {
    result = await verifyAssertion({
      response: authenticationResponse as Parameters<typeof verifyAssertion>[0]["response"],
      expectedChallenge: challenge,
      credential: {
        id: user.passkeyCredentialId,
        publicKey: user.passkeyPublicKey,
        counter: user.passkeyCounter,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Passkey sign-in failed: ${msg}` },
      { status: 401 },
    );
  }
  await clearChallenge("authenticate");

  await db.user.update({
    where: { id: user.id },
    data: { passkeyCounter: result.newCounter },
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
