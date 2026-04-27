# Rein — spend control for AI agents

Give your AI agents a budget they can't exceed. Create an agent, set a
per-payment and monthly limit, add payees, and issue scoped credentials
that your runtime uses to make payments. Rein enforces every payment in
real time — the limits are bound cryptographically and a Rein server
compromise can't widen them.

## Model

```
Company        = the customer                (1 passkey)
 └── Agent     = a named spender             (holds its own balance)
      ├── Payee      = a label'd destination (server-only)
      └── Permission = a scoped credential   (per-payment + monthly cap)
```

All three are 1→N. Balance lives on the Agent. Permissions are what the
agent runtime signs with — each permission is scoped to a per-payment
cap, a monthly cap, and an optional payee allow-list.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) — note: this is NOT the
  Next.js in your training data; see `AGENTS.md`.
- **Tailwind 4** + shadcn-style components
- **@simplewebauthn** — direct passkey register / authenticate
- **Prisma 7** on SQLite via `@prisma/adapter-better-sqlite3`

## Run locally

```bash
cp .env.example .env.local
# fill in the env vars

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open <http://localhost:3000> — the root redirects to `/login`.

## Self-hosting / running on a new network

See [`OPERATOR.md`](./OPERATOR.md) for the full env shape, the
boot-time contract presence check, and the workflow for bringing Rein
up on a new chain. `.env.example` is the template.

## What's in the UI

- `/` → redirects to `/login` (or `/dashboard` if signed in).
- `/login` — passkey sign-up / sign-in.
- `/dashboard` — total balance across agents, active agent count, spent
  this month, recent agents, "+ New agent".
- `/dashboard/agents` — table: Name, Balance, Spent this month,
  Permissions, Status, Actions.
- `/dashboard/agents/new` — form: Name.
- `/dashboard/agents/[id]` — Overview, Permissions, Payees tabs.
- `/dashboard/agents/[id]/permissions/new` — form + one-shot credentials
  modal (API key ID + API secret).

Every agent detail page has a **Deposit** button that reveals the
agent's deposit address and QR code so external sources can fund it.

## Runtime (agent-facing API)

```
POST /api/payments
{
  "apiKeyId":  "<permission id>",
  "apiSecret": "<api secret>",
  "payeeId":   "<payee id>",            // or "to": "0x..."
  "amountUsd": 5
}
```

The cap is enforced cryptographically; exceeding it causes the request
to fail and the server records `status = failed`.

## Security invariants

Documented in `CLAUDE.md`. Short version:

1. Every Agent gets a unique owner key, encrypted at rest with
   `APP_ENCRYPTION_KEY`.
2. Each Permission's secret is returned ONCE as `apiSecret` and never
   persisted in plaintext.
3. Caller must present `apiSecret` on every `/api/payments` request — a
   DB-only compromise cannot sign.
4. The dashboard never shows addresses, hex strings, or chain names —
   see the vocabulary ban in `CLAUDE.md`. The address-visible surfaces
   are the payee-add form, the one-shot credentials modal, and the
   opt-in Deposit reveal.
5. `approve_vendor` without any payee allow-list is rejected with 400.

## Not yet implemented / known follow-ups

- Passkey-owner agents (per-signature user verification).
- Real fiat on-ramp.
- **Card-provider pull payments, scoped to the same caps.** Issue a
  virtual card and make the provider's settlement entrypoint a payee —
  the card provider can charge the Agent up to the per-tx and monthly
  caps, but cannot drain the account or move funds anywhere else.
- Multi-admin quorum, 24h timelock on expansions.
- Framework adapters.
