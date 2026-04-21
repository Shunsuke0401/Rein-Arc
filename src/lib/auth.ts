import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "./db";

const SESSION_COOKIE = "rein_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const CHALLENGE_COOKIE_PREFIX = "rein_webauthn_";
const CHALLENGE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export type SessionUser = {
  id: string;
  email: string;
  companyName: string;
  passkeyCredentialId: string;
};

export async function issueSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, token, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  return token;
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: row.user.id,
    email: row.user.email,
    companyName: row.user.companyName,
    passkeyCredentialId: row.user.passkeyCredentialId,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// -----------------------------------------------------------------------------
// WebAuthn challenge handling — ceremony-scoped cookies written by the server
// just before sending options to the client.
// -----------------------------------------------------------------------------

export async function storeChallenge(purpose: "register" | "authenticate", challenge: string) {
  const jar = await cookies();
  jar.set(`${CHALLENGE_COOKIE_PREFIX}${purpose}`, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + CHALLENGE_TTL_MS),
    path: "/",
  });
}

export async function readChallenge(purpose: "register" | "authenticate"): Promise<string | null> {
  const jar = await cookies();
  return jar.get(`${CHALLENGE_COOKIE_PREFIX}${purpose}`)?.value ?? null;
}

export async function clearChallenge(purpose: "register" | "authenticate") {
  const jar = await cookies();
  jar.delete(`${CHALLENGE_COOKIE_PREFIX}${purpose}`);
}
