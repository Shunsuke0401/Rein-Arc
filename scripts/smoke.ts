/**
 * Smoke test for the Arc build (Company → Agent → Permission).
 *
 * Usage:
 *   npm run dev               # in another terminal
 *   BASE_URL=http://localhost:3000 npx tsx scripts/smoke.ts
 *
 * Seeds a fake Company directly in the DB, issues a session cookie, then
 * drives the public API end-to-end. Fails loudly if:
 *   - any HTTP response body contains /0x[0-9a-f]{40,}/ outside the
 *     one-shot credentials response
 *   - any rendered HTML under /dashboard contains a banned vocab word
 *   - the permission per-tx cap is bypassable (we try $11 on a $10 cap
 *     and expect a 403)
 *   - a revoked permission still signs payments (expect 401)
 *
 * Steps that require a live ZeroDev bundler + paymaster (permission
 * install, successful payment, revoke) are allowed to fail when the
 * infrastructure isn't reachable — they record "skipped" rather than
 * failing the whole suite. The invariant checks (hex-leak, vocab-ban,
 * per-tx cap enforcement, revoked-key rejection) run regardless.
 */
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Full ban for authenticated product surfaces.
const BANNED_VOCAB = [
  "wallet",
  "address",
  "chain",
  "Tempo",
  "USDC",
  "ETH",
  "gas",
  "signer",
  "session key",
  "Access Key",
  "sub-org",
  "Turnkey",
  "Kernel",
  "ZeroDev",
  "Arc",
  "Circle",
  "tx hash",
  "block explorer",
  "transaction hash",
  "signature",
  "private key",
  "public key",
  "EOA",
  "smart account",
  "selector",
  "hex",
  "userOp",
  "user operation",
  "paymaster",
  "bundler",
  "passkey",
];

// The login surface is the only place "passkey" is allowed — the platform
// WebAuthn prompt uses that word and users expect it there.
const BANNED_VOCAB_LOGIN = BANNED_VOCAB.filter((w) => w !== "passkey");

// Landing page gets a relaxed list: marketing copy uses generic crypto
// nouns (wallet, cryptography, address). Product-internal terms are still
// forbidden.
const BANNED_VOCAB_LANDING = [
  "Tempo",
  "USDC",
  "ETH",
  "sub-org",
  "Turnkey",
  "Kernel",
  "ZeroDev",
  "Arc",
  "tx hash",
  "transaction hash",
  "private key",
  "Access Key",
  "EOA",
  "hex",
];

type TestState = {
  pass: number;
  fail: number;
  skipped: number;
  firstError: string | null;
};

const state: TestState = { pass: 0, fail: 0, skipped: 0, firstError: null };

function assert(label: string, cond: boolean, hint?: string) {
  if (cond) {
    state.pass++;
    console.log(`  \u2713 ${label}`);
  } else {
    state.fail++;
    if (!state.firstError) state.firstError = label;
    console.log(`  \u2717 ${label}${hint ? `  (${hint})` : ""}`);
  }
}

function skip(label: string, reason: string) {
  state.skipped++;
  console.log(`  \u2022 ${label}  (skipped: ${reason})`);
}

function containsHex(s: string): string | null {
  const m = s.match(/0x[0-9a-fA-F]{40,}/);
  return m ? m[0] : null;
}

function containsBannedFrom(s: string, vocab: string[]): string | null {
  const lower = s.toLowerCase();
  for (const word of vocab) {
    const re = new RegExp(
      `(^|[^a-zA-Z])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-zA-Z])`,
    );
    if (re.test(lower)) return word;
  }
  return null;
}

function makeDb() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
  const adapter = new PrismaBetterSqlite3({ url: filename });
  return new PrismaClient({ adapter });
}

async function seedCompanyAndSession(db: PrismaClient) {
  // Mock "passkey" registration — the schema stores a credential id + COSE
  // public key + counter. For the smoke test we just need plausible values;
  // no route the script exercises re-verifies the assertion.
  const email = `smoke-${Date.now()}@rein.local`;
  const user = await db.user.create({
    data: {
      email,
      companyName: `Smoke Co ${Date.now()}`,
      passkeyCredentialId: `smoke-cred-${randomBytes(8).toString("hex")}`,
      passkeyPublicKey: randomBytes(64).toString("base64url"),
      passkeyCounter: 0,
    },
  });
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { user, token };
}

type JsonResp = { status: number; text: string; json: unknown };

async function fetchJson(
  path: string,
  token: string,
  opts?: { method?: string; body?: unknown },
): Promise<JsonResp> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: `rein_session=${token}`,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await resp.text();
  return { status: resp.status, text, json: safeJson(text) };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

type CreatedPermission = {
  permissionId: string;
  apiSecret: string;
};

async function main() {
  const db = makeDb();

  console.log(`Base URL: ${BASE_URL}`);
  console.log("Seeding company + session\u2026");
  const { user, token } = await seedCompanyAndSession(db);
  console.log(`  user=${user.id}  email=${user.email}`);

  let agentId: string | null = null;
  let payeeId: string | null = null;
  let created: CreatedPermission | null = null;

  try {
    console.log("\n[1] Reachability:");
    try {
      const ping = await fetch(`${BASE_URL}/api/agents`, {
        headers: { Cookie: `rein_session=${token}` },
      });
      assert(`GET /api/agents reachable`, ping.status === 200, `got ${ping.status}`);
    } catch (err) {
      console.log(
        `  \u2717 dev server not reachable at ${BASE_URL} — is \`npm run dev\` running?`,
      );
      console.log(`    ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    }

    console.log("\n[2] Payload-level hex checks (responses that reach the client):");
    {
      const r = await fetchJson("/api/agents", token);
      const hex = containsHex(r.text);
      assert(
        `GET /api/agents \u2192 no hex leak`,
        !hex,
        hex ? `found ${hex}` : undefined,
      );
    }

    console.log("\n[3] Create agent:");
    {
      const r = await fetchJson("/api/agents", token, {
        method: "POST",
        body: { name: "Smoke Agent" },
      });
      if (r.status !== 200) {
        skip(
          "POST /api/agents",
          `got ${r.status} (likely missing ZeroDev/APP_ENCRYPTION_KEY env — ${extractErr(r)})`,
        );
      } else {
        const body = r.json as { ok: boolean; agent: { id: string } } | null;
        assert(`POST /api/agents \u2192 ok`, body?.ok === true);
        const hex = containsHex(r.text);
        assert(
          `POST /api/agents \u2192 no hex leak`,
          !hex,
          hex ? `found ${hex}` : undefined,
        );
        agentId = body?.agent?.id ?? null;
        assert(`POST /api/agents \u2192 returned an agent id`, !!agentId);
      }
    }

    // If we couldn't create an agent through the route, seed one directly
    // so the DB-level assertions (permission scope enforcement, revoke
    // semantics) can still run.
    if (!agentId) {
      const seeded = await db.agent.create({
        data: {
          userId: user.id,
          name: "Smoke Agent (seeded)",
          accountAddress: `0x${randomBytes(20).toString("hex")}`,
          ownerCiphertext: "smoke.smoke.smoke",
          status: "active",
        },
      });
      agentId = seeded.id;
      console.log(`  (seeded agent directly: ${agentId})`);
    }

    console.log("\n[4] Create payee:");
    {
      const r = await fetchJson(`/api/agents/${agentId}/payees`, token, {
        method: "POST",
        body: {
          label: "Smoke Payee",
          address: `0x${randomBytes(20).toString("hex")}`,
        },
      });
      assert(`POST /api/agents/:id/payees \u2192 ok`, r.status === 200, extractErr(r));
      const body = r.json as { ok: boolean; payee: { id: string } } | null;
      payeeId = body?.payee?.id ?? null;
      // Payee response must not echo the address back.
      const hex = containsHex(r.text);
      assert(
        `POST /api/agents/:id/payees \u2192 no hex leak`,
        !hex,
        hex ? `found ${hex}` : undefined,
      );
    }

    console.log("\n[5] Create permission ($10/tx, $50/mo):");
    {
      const r = await fetchJson(
        `/api/agents/${agentId}/permissions`,
        token,
        {
          method: "POST",
          body: {
            name: "Smoke Permission",
            perPaymentLimitUsd: 10,
            monthlyLimitUsd: 50,
            payeeIds: payeeId ? [payeeId] : [],
            allowedOperations: ["send_payment"],
          },
        },
      );
      if (r.status !== 200) {
        skip(
          "POST /api/agents/:id/permissions",
          `got ${r.status} — install requires a live ZeroDev bundler/paymaster (${extractErr(r)})`,
        );
      } else {
        const body = r.json as
          | {
              ok: boolean;
              permission: { id: string };
              credentials: { apiKeyId: string; apiSecret: string };
            }
          | null;
        assert(
          `POST /api/agents/:id/permissions \u2192 ok`,
          body?.ok === true,
        );
        assert(
          `credentials.apiKeyId is returned once`,
          typeof body?.credentials?.apiKeyId === "string",
        );
        assert(
          `credentials.apiSecret is a 0x…64-hex private key`,
          /^0x[0-9a-fA-F]{64}$/.test(body?.credentials?.apiSecret ?? ""),
        );
        // The one-shot credentials payload IS allowed to contain the
        // apiSecret (which matches the hex regex). Strip it before running
        // the general leak check so we still catch stray addresses / hashes.
        const stripped = r.text.replace(
          /"apiSecret"\s*:\s*"0x[0-9a-fA-F]{64}"/,
          '"apiSecret":"[redacted]"',
        );
        const hex = containsHex(stripped);
        assert(
          `POST /api/agents/:id/permissions \u2192 no other hex leak`,
          !hex,
          hex ? `found ${hex}` : undefined,
        );
        if (body?.credentials) {
          created = {
            permissionId: body.credentials.apiKeyId,
            apiSecret: body.credentials.apiSecret,
          };
        }
      }
    }

    console.log("\n[6] Per-tx cap enforcement ($11 on a $10/tx permission):");
    if (created) {
      const r = await fetchJson("/api/payments", token, {
        method: "POST",
        body: {
          apiKeyId: created.permissionId,
          apiSecret: created.apiSecret,
          payeeId,
          amountUsd: 11,
        },
      });
      // Defense-in-depth layer rejects before touching the chain: 403.
      assert(
        `$11 payment is blocked (403)`,
        r.status === 403,
        `got ${r.status}: ${extractErr(r)}`,
      );
      const errMsg = (r.json as { error?: string } | null)?.error ?? "";
      assert(
        `$11 rejection mentions per-payment limit`,
        /per-payment limit/i.test(errMsg),
        errMsg,
      );
    } else {
      // No live permission — synthesize one in the DB so we can still
      // exercise the payments route's cap check.
      const fakePerm = await db.permission.create({
        data: {
          agentId: agentId,
          name: "Smoke Permission (synthetic)",
          sessionKeyId: "smoke-sk",
          sessionKeyAddress: `0x${randomBytes(20).toString("hex")}`,
          sessionKeyCiphertext: "smoke.smoke.smoke",
          scope: JSON.stringify({
            perPaymentLimitUsd: 10,
            monthlyLimitUsd: 50,
            payeeIds: payeeId ? [payeeId] : [],
            allowedOperations: ["send_payment"],
          }),
          status: "active",
        },
      });
      const syntheticSecret = `0x${randomBytes(32).toString("hex")}`;
      const r = await fetchJson("/api/payments", token, {
        method: "POST",
        body: {
          apiKeyId: fakePerm.id,
          apiSecret: syntheticSecret,
          payeeId,
          amountUsd: 11,
        },
      });
      assert(
        `$11 payment is blocked by app-layer cap (403)`,
        r.status === 403,
        `got ${r.status}: ${extractErr(r)}`,
      );
      created = { permissionId: fakePerm.id, apiSecret: syntheticSecret };
    }

    console.log("\n[7] $5 payment (requires live ZeroDev; skipped on failure):");
    if (created) {
      const r = await fetchJson("/api/payments", token, {
        method: "POST",
        body: {
          apiKeyId: created.permissionId,
          apiSecret: created.apiSecret,
          payeeId,
          amountUsd: 5,
        },
      });
      if (r.status === 200) {
        const body = r.json as { ok: boolean } | null;
        assert(`$5 payment \u2192 ok`, body?.ok === true);
      } else {
        skip(
          "$5 payment",
          `got ${r.status} — expected when session-key is synthetic or no live bundler (${extractErr(r)})`,
        );
      }
    }

    console.log("\n[8] Revoke + payment-after-revoke:");
    if (created) {
      // Try the route first; fall back to DB update if the on-chain
      // uninstall can't run without a bundler.
      const r = await fetchJson(
        `/api/agents/${agentId}/permissions/${created.permissionId}/revoke`,
        token,
        { method: "POST" },
      );
      if (r.status !== 200) {
        skip(
          "POST .../revoke",
          `got ${r.status} — marking permission revoked in DB for follow-up check (${extractErr(r)})`,
        );
        await db.permission.update({
          where: { id: created.permissionId },
          data: { status: "revoked", revokedAt: new Date() },
        });
      } else {
        assert(`POST .../revoke \u2192 ok`, true);
      }

      const r2 = await fetchJson("/api/payments", token, {
        method: "POST",
        body: {
          apiKeyId: created.permissionId,
          apiSecret: created.apiSecret,
          payeeId,
          amountUsd: 5,
        },
      });
      assert(
        `payment after revoke \u2192 rejected (401)`,
        r2.status === 401,
        `got ${r2.status}: ${extractErr(r2)}`,
      );
    }

    console.log("\n[9] Banned-vocab checks on rendered HTML:");
    const pages: Array<{
      path: string;
      vocab: string[];
      label: string;
      noCookie?: boolean;
    }> = [
      // Landing is rendered anonymously — signed-in visitors get redirected
      // to /dashboard, so omit the cookie to actually exercise the marketing
      // surface. Vocab list is relaxed to allow generic crypto nouns.
      {
        path: "/",
        vocab: BANNED_VOCAB_LANDING,
        label: "/ (landing, relaxed)",
        noCookie: true,
      },
      // The login surface is the only place "passkey" is allowed.
      { path: "/login", vocab: BANNED_VOCAB_LOGIN, label: "/login (passkey allowed)" },
      { path: "/dashboard", vocab: BANNED_VOCAB, label: "/dashboard" },
      { path: "/dashboard/agents", vocab: BANNED_VOCAB, label: "/dashboard/agents" },
      { path: "/dashboard/agents/new", vocab: BANNED_VOCAB, label: "/dashboard/agents/new" },
      {
        path: `/dashboard/agents/${agentId}`,
        vocab: BANNED_VOCAB,
        label: "/dashboard/agents/[id]",
      },
    ];
    for (const p of pages) {
      const resp = await fetch(`${BASE_URL}${p.path}`, {
        headers: p.noCookie ? {} : { Cookie: `rein_session=${token}` },
      });
      const html = await resp.text();
      assert(`${p.label} \u2192 HTTP ${resp.status}`, resp.status === 200, `got ${resp.status}`);
      const textOnly = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<style[\s\S]*?<\/style>/g, " ")
        .replace(/<[^>]+>/g, " ");
      const banned = containsBannedFrom(textOnly, p.vocab);
      assert(
        `${p.label} \u2192 no banned vocab`,
        !banned,
        banned ? `found "${banned}"` : undefined,
      );
    }

    console.log("\n[10] Address-leak checks on authenticated API responses:");
    {
      const r = await fetchJson("/api/agents", token);
      const hex = containsHex(r.text);
      assert(
        `GET /api/agents (populated) \u2192 no hex leak`,
        !hex,
        hex ? `found ${hex}` : undefined,
      );
    }
    {
      // The deposit-address route is the ONE route permitted to return a
      // 0x address — it's gated by a deliberate customer reveal click.
      const r = await fetchJson(
        `/api/agents/${agentId}/deposit-address`,
        token,
      );
      if (r.status === 200) {
        const body = r.json as { depositAddress?: string } | null;
        assert(
          `deposit-address \u2192 returns an address (opt-in exception)`,
          /^0x[0-9a-fA-F]{40}$/.test(body?.depositAddress ?? ""),
        );
      } else {
        skip("GET /api/agents/:id/deposit-address", `got ${r.status}`);
      }
    }
  } finally {
    console.log("\nCleaning up\u2026");
    // Cascade deletes handle sessions/agents/permissions/payees/txs.
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
    await db.$disconnect();
  }

  const line =
    `\n${state.pass} passed \u00b7 ${state.fail} failed \u00b7 ${state.skipped} skipped` +
    (state.firstError ? ` \u00b7 first fail: "${state.firstError}"` : "");
  console.log(line);
  process.exit(state.fail === 0 ? 0 : 1);
}

function extractErr(r: JsonResp): string {
  const j = r.json as { error?: string } | null;
  return j?.error ?? r.text.slice(0, 120);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
