/**
 * Seed a User + Session for UI walkthroughs — bypasses the passkey flow.
 * Prints the session token to stdout. Usage:
 *   npx tsx scripts/seed-session.ts
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
  const adapter = new PrismaBetterSqlite3({ url: filename });
  const db = new PrismaClient({ adapter });

  const email = `demo-${Date.now()}@rein.local`;
  const user = await db.user.create({
    data: {
      email,
      companyName: "Demo Co",
      passkeyCredentialId: `demo-cred-${randomBytes(8).toString("hex")}`,
      passkeyPublicKey: randomBytes(64).toString("base64url"),
      passkeyCounter: 0,
    },
  });
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log(JSON.stringify({ userId: user.id, email, token }));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
