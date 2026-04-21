import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM at-rest encryption for session-key material (and, server-side,
// Kernel-owner signing keys). APP_ENCRYPTION_KEY must be a 32-byte value
// supplied as 64 hex chars.

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate with: node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))'",
    );
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length})`,
    );
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, ctHex] = ciphertext.split(".");
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error("Malformed ciphertext envelope");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export const encryptionConfigured = Boolean(process.env.APP_ENCRYPTION_KEY);
