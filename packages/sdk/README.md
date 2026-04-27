# rein-sdk

Bounded payments for AI agents. One API key, hard spend caps the caller can't bypass.

## Install

```bash
npm install rein-sdk
```

## Quickstart

Get an API key: create an agent in the Rein dashboard, save the `REIN_API_KEY` from the one-shot credentials modal.

```ts
import { Rein } from "rein-sdk";

const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });

const payment = await rein.payments.create({
  to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518", // address of a saved payee
  amountUsd: 50,
});

console.log(payment.status); // "confirmed"
```

## What the caps enforce

Every API key is scoped by the permission you set at creation:

- **Per-payment cap** — a single call over this amount is rejected.
- **Monthly cap** — approximated as N calls × per-payment, reset every 30 days.
- **Payee allow-list** — if you saved payees, the `to` value must match one of them. Anything else is rejected.

A Rein server compromise **cannot** widen these. They're enforced cryptographically.

## API

### `rein.payments.create({ to, amountUsd, note? })`

Sends funds to a recipient. `to` is the destination address of a saved payee. Returns `{ id, status, amountUsd, to, createdAt }`.

### `rein.agent.status()`

Returns agent-level view: name, balance, spent this month, caps, remaining monthly allowance, status.

### `rein.agent.payees()`

Returns saved payees for this permission as `[{ id, label }]`. Destination data is never returned.

### `rein.agent.activity({ limit? })`

Returns the most recent payment activity as `[{ timestamp, direction, counterpartyLabel, amountUsd, status }]`.

## Errors

All SDK errors are `ReinError` instances with a typed `code`:

| Code | Meaning |
|---|---|
| `INVALID_API_KEY` | Missing, malformed, or revoked key. |
| `INSUFFICIENT_BALANCE` | The agent's balance is below the requested amount. Top up and retry. |
| `PERMISSION_CAP_EXCEEDED` | Amount exceeds the per-payment cap, or the request was rejected by the policy. |
| `PAYEE_NOT_ALLOWED` | Recipient not on the permission's payee allow-list. |
| `PAYMENT_IN_FLIGHT` | A previous payment is still being processed. Wait ~30s and retry. Do **not** retry immediately — you'll just keep hitting this. |
| `NOT_FOUND` | Payee label or resource doesn't exist. |
| `NETWORK_ERROR` | Timeout or transport failure. |
| `INTERNAL` | Server error. |

```ts
import { Rein, ReinError } from "rein-sdk";

try {
  await rein.payments.create({
    to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518",
    amountUsd: 99,
  });
} catch (err) {
  if (err instanceof ReinError && err.code === "PERMISSION_CAP_EXCEEDED") {
    console.error("Over cap:", err.message);
  }
}
```

## Self-hosted base URL

Override `baseUrl` if you run your own Rein instance:

```ts
const rein = new Rein({
  apiKey: process.env.REIN_API_KEY!,
  baseUrl: "https://my-rein.example.com",
});
```
