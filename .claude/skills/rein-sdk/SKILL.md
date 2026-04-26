---
name: rein-sdk
description: Implement the Rein SDK in a project — install `rein-sdk`, initialize the client with a `REIN_API_KEY`, and wire `rein.payments.create` / `rein.agent.status` / `rein.agent.payees` / `rein.agent.activity` into an app or LLM tool-call loop. Use when a user says they want to "add Rein to my agent", "implement rein-sdk", "let my agent pay with Rein", "send USDC from my agent", or imports `rein-sdk` / references `REIN_API_KEY`.
---

# Implementing the Rein SDK

Rein gives an AI agent (or any program) a single API key that can spend USDC within on-chain caps the caller can't bypass. This skill walks through adding it to a project end-to-end.

The SDK source is in this repo at `packages/sdk/src/index.ts`. The server endpoints it talks to are in `src/app/api/v1/`. Read those files when behavior is unclear — they are the source of truth.

---

## 1. Mental model (read this first)

A Rein API key is a **scoped session key** for one Agent's smart account on Arc. The scope is set when the credential is created in the Rein dashboard:

- **Per-payment cap** — single transfer over this amount reverts on-chain.
- **Monthly cap** — approximated as a 30-day rate-limit (≤ N transfers, where N = ⌈monthlyCap / perPaymentCap⌉).
- **Payee allow-list** — if set, `to` must match one of the pinned 0x addresses; everything else reverts.

Server-side enforcement is defense-in-depth. The authoritative checks happen in the agent's Kernel permission validator, not in the Rein server.

**Consequences for the integrator:**
- A leaked API key can only do what the policies allow — it cannot drain the agent or pay arbitrary recipients.
- A Rein server compromise cannot widen the caps either; the validator is on-chain.
- `to` must be a raw `0x…` 40-hex-character address. Labels are not accepted by `payments.create` — duplicate/typo'd labels would be ambiguous, and the on-chain allow-list pins addresses anyway.

---

## 2. Prerequisites

Before writing any code:

1. **Create an Agent and a Permission** in the Rein dashboard. The Permission's one-shot credentials modal (`src/components/credentials-modal.tsx`) shows the **API key** exactly once. It looks like `rein_<permissionId>_<sessionKeyHex>`. **There is no "show again" — copy it now or you must rotate.**
2. **Fund the Agent.** Open the agent's funding dialog — either "Add funds" (mock fiat top-up) or "Deposit" (reveal the agent's deposit address and send USDC on Arc). An empty agent will return an on-chain error on the first payment.
3. **Save saved payees** if you plan to restrict recipients. Each payee is a `(label, 0x-address)` pair; the SDK's `agent.payees()` returns labels and ids only — addresses stay server-side.

Store the API key as `REIN_API_KEY` in the caller's environment. Never check it into a repo.

---

## 3. Install

```bash
npm install rein-sdk
```

The package targets ESM only (`"type": "module"` in `packages/sdk/package.json`). For a CommonJS host, use a dynamic `import()` or build with a bundler that handles ESM → CJS.

If you're consuming directly from this monorepo before publish:

```bash
npm install github:Shunsuke0401/Rein-Arc#main
```

---

## 4. Initialize the client

```ts
import { Rein } from "rein-sdk";

const rein = new Rein({
  apiKey: process.env.REIN_API_KEY!,
  // baseUrl defaults to the hosted Rein instance.
  // Override only when self-hosting:
  // baseUrl: "https://my-rein.example.com",
  // timeoutMs: 30_000,        // optional; default 30s
  // fetch: customFetch,        // optional; defaults to globalThis.fetch
});
```

The constructor throws `ReinError({ code: "INVALID_API_KEY" })` if the key doesn't start with `rein_`. Validate the env var at process start so you fail loudly, not on the first payment.

---

## 5. Core operations

### `rein.payments.create({ to, amountUsd, note? })`

Sends USDC. `to` **must** be a `0x` + 40 hex chars; the SDK rejects anything else with `PAYEE_NOT_ALLOWED` before hitting the network. `note` is server-side only — it never touches the chain.

```ts
const payment = await rein.payments.create({
  to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518",
  amountUsd: 50,
  note: "refund #4212",
});
// → { id, status: "confirmed", amountUsd, to, createdAt }
```

The call returns only after the userOp is confirmed by the bundler. Expected latency on Arc: ≈ 1–3 seconds. If you need fire-and-forget, wrap it in a job queue yourself — there is no async-ack mode.

### `rein.agent.status()`

Use this to display "remaining budget" in your UI or to gate calls before paying.

```ts
const s = await rein.agent.status();
if (s.remainingMonthlyUsd < amountUsd) {
  // refuse the action; over-cap calls revert on-chain anyway, but a
  // pre-check produces a cleaner error path.
}
```

### `rein.agent.payees()`

Returns `[{ id, label }]` for every payee saved on the agent. **Addresses are intentionally not returned.** Use `id` to disambiguate labels when prompting an LLM.

### `rein.agent.activity({ limit? })`

Returns recent transactions: `[{ timestamp, direction, counterpartyLabel, amountUsd, status }]`. Default limit is 10. Useful for an audit / history pane.

---

## 6. Wiring into an LLM tool-call loop

This is the canonical use case. Reference example: `examples/ai-agent-pay.ts`.

Recommended shape (OpenAI-style; same idea for Anthropic, Vercel AI SDK, etc.):

```ts
import OpenAI from "openai";
import { Rein, ReinError } from "rein-sdk";

const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });
const openai = new OpenAI();

// 1. Surface payees as labels — don't put 0x addresses in the prompt.
const payees = await rein.agent.payees();

const tools = [
  {
    type: "function" as const,
    function: {
      name: "pay",
      description:
        "Send USDC to a saved payee. Per-payment and monthly caps are enforced on-chain; over-cap or off-list calls will revert.",
      parameters: {
        type: "object",
        properties: {
          payeeId:   { type: "string", description: "ID of a saved payee." },
          amountUsd: { type: "number", description: "Amount in USD." },
          memo:      { type: "string", description: "Internal note (not on-chain)." },
        },
        required: ["payeeId", "amountUsd"],
      },
    },
  },
];

// 2. Resolve the payee server-side — the model never sees the address.
async function pay(payeeId: string, amountUsd: number, memo?: string) {
  const payee = payees.find((p) => p.id === payeeId);
  if (!payee) throw new Error(`unknown payeeId: ${payeeId}`);

  // The 0x address mapping for `payeeId` lives in your own DB or config.
  // The SDK requires a raw 0x — labels/ids are not accepted.
  const to = lookupAddressFor(payee.id);

  return rein.payments.create({ to, amountUsd, note: memo });
}
```

**Design rules for the tool surface:**

1. **Never let the model produce a `0x` address.** Give it `payeeId`s; resolve to addresses in your own code. The model has no business choosing arbitrary recipients — and the on-chain allow-list will reject anything off-list anyway, but you don't want the model wasting tool calls discovering that.
2. **Surface the cap in the tool description.** Models are better at staying inside a budget when they know the budget exists.
3. **Pass through `ReinError.code`, don't swallow it.** A 403 `PERMISSION_CAP_EXCEEDED` should become a tool-result message the model can read and recover from ("budget exceeded; ask user to raise the cap or split the payment").

---

## 7. Error handling

Every SDK error is a `ReinError` with a typed `code`:

| `code` | HTTP | Cause | Recovery |
|---|---|---|---|
| `INVALID_API_KEY` | 401 | Missing / malformed / revoked key | Rotate via dashboard |
| `PERMISSION_CAP_EXCEEDED` | 403 | Amount > per-payment cap, or rate-limit hit, or on-chain revert | Check `agent.status()`; surface to user |
| `PAYEE_NOT_ALLOWED` | 400 | `to` not a `0x` address, or not on the on-chain allow-list | Use `payees()` and pin to known addresses |
| `NOT_FOUND` | 404 | Resource doesn't exist | Verify ids |
| `NETWORK_ERROR` | 0 | Timeout / transport | Retry with backoff |
| `INTERNAL` | 5xx | Rein server error | Retry; report to Rein |

Always check `instanceof ReinError` before reading `.code` — generic errors (`fetch` failures pre-wrap) come through as `NETWORK_ERROR`, but a thrown `Error` from your own `lookupAddressFor` will not.

```ts
try {
  await rein.payments.create({ to, amountUsd });
} catch (err) {
  if (err instanceof ReinError) {
    if (err.code === "PERMISSION_CAP_EXCEEDED") {
      // expected business outcome
    } else if (err.code === "NETWORK_ERROR") {
      // retry
    } else {
      throw err;
    }
  } else {
    throw err;
  }
}
```

---

## 8. Self-hosting

If the team runs its own Rein instance (the Next.js app in this repo), point the SDK at it:

```ts
const rein = new Rein({
  apiKey: process.env.REIN_API_KEY!,
  baseUrl: "https://rein.internal.example.com",
});
```

A self-hosted instance must have:
- `APP_ENCRYPTION_KEY` set (the SDK endpoint refuses requests with `code: "INTERNAL"` / 503 if encryption is unconfigured — see `src/app/api/v1/payments/route.ts:34`).
- `ZERODEV_PROJECT_ID`, `ZERODEV_BUNDLER_URL`, `ZERODEV_PAYMASTER_URL` configured against an Arc bundler/paymaster.
- A funded paymaster — every payment is a sponsored userOp; if the paymaster is empty, even valid calls fail.
- A populated `USDC_CONTRACT_ARC` env var.

---

## 9. Common pitfalls

- **"Labels" used to work; they don't anymore.** Older docs may show `to: "Stripe payouts"`. The current SDK rejects this client-side. Always pass an address.
- **First payment after creating the agent is slower** (≈ 5–10 s) because it triggers Kernel deployment + permission install in one userOp. Subsequent payments are ≈ 1–3 s.
- **Rate-limit is approximate.** The on-chain RateLimitPolicy counts *calls*, not USD. Your monthly cap is ⌈monthlyCap / perPaymentCap⌉ calls per 30-day window — small payments use up "slots" too. Budget per-payment caps with this in mind.
- **`agent.status().balanceUsd` is a live on-chain read.** Treat it as eventually-consistent for UI; don't use it as a transactional pre-check (race the userOp).
- **Revoked permissions stay 401 forever.** There is no soft-delete; rotate the API key by creating a new permission and revoking the old.
- **Paymaster outages look like `INTERNAL` errors.** If every payment 5xx's, check the operator's paymaster funding before debugging your code.

---

## 10. Where to read further

- SDK source — `packages/sdk/src/index.ts`
- Server endpoints — `src/app/api/v1/payments/route.ts`, `src/app/api/v1/agent/route.ts`, `src/app/api/v1/agent/payees/route.ts`, `src/app/api/v1/agent/activity/route.ts`
- Bearer auth packing — `src/lib/sdk-auth.ts`
- Kernel + session-key signing path — `src/lib/kernel.ts` (`sendUsdcFromSessionKey`)
- Architecture overview — `src/app/(docs)/docs/architecture/page.tsx` and `CLAUDE.md` invariants
- End-to-end LLM example — `examples/ai-agent-pay.ts`

When in doubt, the policy enforcement is on-chain and reading `kernel.ts` will tell you what is and isn't possible.
