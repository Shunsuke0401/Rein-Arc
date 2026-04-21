# Rein — spend control for AI agents

Give your AI agents a budget they can't exceed. Create an agent, set a
per-payment and monthly limit, add payees, and issue scoped credentials that
your runtime uses to make payments. Rein enforces every payment in real time
on-chain.

Built on Arc (Circle's L1) with ZeroDev Kernel v3 smart accounts and
direct WebAuthn passkeys.

## Model

```
Company        = the customer                (1 WebAuthn passkey)
 └── Agent     = a named spender             (1 ZeroDev Kernel, holds balance)
      ├── Payee      = a label'd destination (server-only)
      └── Permission = a scoped credential   (1 session-key plugin)
```

All three are 1→N. Balance lives on the Agent. Permissions are what the
agent runtime signs with — each permission installs a session-key on the
Agent's Kernel with on-chain call and rate-limit policies.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) — note: this is NOT the
  Next.js in your training data; see `AGENTS.md`.
- **Tailwind 4** + shadcn-style components
- **ZeroDev SDK v5** — Kernel v3.1 smart accounts, permission/session-key
  plugins, paymaster-sponsored user operations
- **@simplewebauthn** — direct WebAuthn register/authenticate (no third-party)
- **viem 2** against Arc RPC
- **Prisma 7** on SQLite via `@prisma/adapter-better-sqlite3`

## Run locally

```bash
cp .env.example .env.local
# fill in the env vars below

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open <http://localhost:3000> — the root redirects to `/login`.

## Env vars

### Arc (testnet-only today)

Copy the current values from
<https://docs.arc.network/references/connect-to-arc.md>.

```bash
ARC_RPC_URL="https://rpc.testnet.arc.network"
ARC_CHAIN_ID="28882"
NEXT_PUBLIC_ARC_CHAIN_ID="28882"
USDC_CONTRACT_ARC="0x..."   # from docs.arc.network/references/contract-addresses
```

### ZeroDev

Create a project targeting Arc Testnet at
<https://dashboard.zerodev.app/>. Copy the bundler + paymaster URLs.

```bash
ZERODEV_PROJECT_ID="..."
ZERODEV_BUNDLER_URL="https://rpc.zerodev.app/api/v2/bundler/<project>"
ZERODEV_PAYMASTER_URL="https://rpc.zerodev.app/api/v2/paymaster/<project>"
NEXT_PUBLIC_ZERODEV_PROJECT_ID="..."
```

The paymaster must be configured to sponsor calls from your project — all
user-visible gas (Kernel deployment, session-key install, payment sends,
revoke) runs through it.

### WebAuthn

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_RP_NAME="Rein"
```

### Mock fiat on-ramp

Fund a testnet EOA at <https://faucet.circle.com> with USDC, then:

```bash
REIN_ONRAMP_FUNDER_PRIVATE_KEY="0x..."
REIN_ONRAMP_FUNDER_ADDRESS="0x..."
```

The "Add funds" tab transfers USDC from this EOA to the target agent. In
production this becomes a real Stripe / Circle fiat on-ramp call.

### At-rest encryption

```bash
APP_ENCRYPTION_KEY="64 hex chars"
# generate with:
node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
```

Used to encrypt per-agent Kernel owner keys and session-key permission
blobs at rest.

## What's in the UI

- `/` → redirects to `/login` (or `/dashboard` if signed in).
- `/login` — passkey sign-up / sign-in.
- `/dashboard` — total balance across agents, active agent count, spent
  this month, recent agents, "+ New agent".
- `/dashboard/agents` — table: Name, Balance, Spent this month,
  Permissions, Status, Actions.
- `/dashboard/agents/new` — form: Name.
- `/dashboard/agents/[id]` — Overview tab with Balance, Spent this month,
  Activity list; Permissions tab (list + "+ New permission"); Payees tab.
- `/dashboard/agents/[id]/permissions/new` — form + one-shot credentials
  modal (API key ID + API secret).

Every agent detail page has a **Top up** button that opens the funding
modal:
- **Add funds** tab — USD amount input; on submit triggers the mock fiat
  on-ramp (funder EOA transfers USDC to the agent's Kernel).
- **Deposit** tab — "Reveal deposit address" shows the Kernel address +
  QR code for external deposits.

## Runtime (agent-facing API)

```
POST /api/payments
{
  "apiKeyId":  "<permission id>",
  "apiSecret": "0x<session-key private key>",
  "payeeId":   "<payee id>",            // or "to": "0x..."
  "amountUsd": 5
}
```

The server decrypts the permission's serialized Kernel account, attaches
the caller-provided session key as the signer, and sends a USDC transfer
userOp through the ZeroDev bundler. The on-chain permission plugin
enforces the per-payment cap; exceeding it causes the bundler to reject
and the server records `status = failed`.

## Security invariants

Documented in `CLAUDE.md`. Short version:

1. Every Agent gets a unique ECDSA Kernel owner key, encrypted at rest
   with `APP_ENCRYPTION_KEY`.
2. Each Permission installs a ZeroDev session-key plugin scoped by
   CallPolicy + RateLimitPolicy. The session-key private key is returned
   ONCE as `apiSecret` and never persisted in plaintext.
3. Caller must present `apiSecret` on every `/api/payments` request — a
   DB-only compromise cannot sign.
4. UI never shows addresses, tx hashes, chain names, or hex strings — see
   the vocabulary ban in `CLAUDE.md`. The one address-visible surfaces
   are the payee-add form, the one-shot credentials modal, and the
   opt-in Deposit tab.
5. `approve_vendor` without any payee allow-list is rejected with 400
   (transferFrom bypass mitigation).

## Not yet implemented / known follow-ups

- Passkey-owner Kernel (today's owner is an ECDSA key held server-side
  under encryption; moving to WebAuthn owner with per-signature UV is a
  known follow-up — see `src/lib/kernel.ts`).
- Real fiat on-ramp (Stripe / Circle API).
- Multi-admin quorum, 24h timelock on expansions.
- Framework adapters.
