import { NextResponse } from "next/server";
import { z } from "zod";

import { storeChallenge } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAuthenticationOptions } from "@/lib/passkey";

const bodySchema = z.object({
  email: z.string().email().toLowerCase(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json(
      { error: "No account found for that email." },
      { status: 404 },
    );
  }
  const options = await buildAuthenticationOptions({
    allowCredentialId: user.passkeyCredentialId,
  });
  await storeChallenge("authenticate", options.challenge);
  return NextResponse.json({ options });
}
