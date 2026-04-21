import { NextResponse } from "next/server";
import { z } from "zod";

import { storeChallenge } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildRegistrationOptions } from "@/lib/passkey";

// Step 1 of signup: the client posts email + companyName, the server builds
// WebAuthn creation options and stores the challenge in a short-lived cookie.
// The browser then invokes @simplewebauthn/browser → startRegistration(options)
// and posts the attestation to POST /api/auth/signup.

const bodySchema = z.object({
  email: z.string().email().toLowerCase(),
  companyName: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, companyName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account already exists for this email. Try signing in." },
      { status: 409 },
    );
  }

  // Use the email hash as a stable-ish userHandle before we have a user row.
  const options = await buildRegistrationOptions({
    userId: `pending:${email}`,
    userName: companyName,
  });
  await storeChallenge("register", options.challenge);
  return NextResponse.json({ options });
}
