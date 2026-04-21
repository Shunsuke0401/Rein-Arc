# Claude Code Prompt — Rein on Arc (hackathon build)

Paste into a fresh Claude Code session. Work in a **new sibling directory**:
`/Users/nakatanishunsuke/Dev/Rein/rein-arc` (copy from `rein-app`, do not
modify the original).

---

## Filesystem access

- **Read access: everything under `/Users/nakatanishunsuke/Dev/Rein/`.**
  Use this to reference the existing `rein-app` (UI, components, API
  shapes, Prisma schema, CLAUDE.md, AGENTS.md, README) as the source
  of truth for what the new build should look and behave like.
- **Write access: ONLY inside `/Users/nakatanishunsuke/Dev/Rein/rein-arc/`.**
  Do not modify, delete, or move anything outside that directory. In
  particular: never touch `rein-app/`, `rein-app/rein-site/`, or any
  root-level files in `Dev/Rein/`.
- When you need to "copy" from `rein-app`, read the file and write a
  new file in `rein-arc/` with the same path — do not use shell `cp`
  or `mv` on the source tree. If you need a bulk copy to bootstrap the
  project, do it once at the very start via `cp -R rein-app rein-arc`
  and then stop touching `rein-app`.

## Context

Rein is an AI-agent spending product. The existing `rein-app` ships on
Tempo with Turnkey. For Circle's "Programmable Money for Humans & Agents"
bounty on Arc, we need the **same product, same UI, same landing page**,
but running on Arc with ZeroDev Kernel smart accounts instead of Tempo
Access Keys + Turnkey.

The bounty is at Arc (Circle's L1). Must use Arc as the underlying
blockchain. First place $3,500.

---

## Hard rules

### 1. Scope = the authenticated app only, NOT the landing page
- **Do NOT copy or rebuild the landing page.** The landing page lives
  separately at `rein-app/rein-site` and its `/sign-in` link will be
  rewired later to point at this Arc app's login. Delete or ignore
  `src/app/page.tsx`, `src/components/hero.tsx`, and any marketing
  components in the new repo — they're dead weight here. The root route
  `/` in `rein-arc` should just redirect to `/login`.
- Dashboard UI (`src/app/(app)/**`) stays byte-identical in layout,
  copy, component structure to the current `rein-app` dashboard.
- All existing components (`agent-form`, `permission-form`, `payee-form`,
  `credentials-modal`, `activity-list`, etc.) keep their props and
  rendered output.
- Three-layer model (Company → Agent → Permission) stays.
- UI vocabulary ban stays (no address, wallet, chain, gas, hex, tx hash,
  Turnkey, ZeroDev, Arc, Kernel, session key visible to user) —
  **with one carve-out**: the "Deposit" tab inside the company treasury
  funding modal is allowed to render the treasury's raw address, a QR
  code, the words "address", "USDC", and "Arc". This is the only
  place. Every other surface (including the rest of the funding modal,
  the agent pages, the dashboard, and the landing page) remains fully
  abstracted. See "Funding flows" below.

The only things that change are:
- `src/lib/*` server implementations
- API route internals (request/response shapes stay the same)
- Prisma schema (column names may change; semantic model does not)
- Auth (passkey via WebAuthn directly, no Turnkey)

### ⚠️ Gas timing is different from Tempo — read this carefully

The gas lifecycle on Arc/Kernel does NOT match Tempo Access Keys.
Do not port the Tempo assumption that "gas is paid at permission
install time."

**On Tempo (the current `rein-app`):**
- Account creation = free (Tempo accounts are native; nothing deploys)
- Permission install = **gas moment** (`authorizeKey` tx)
- Each payment = gas moment

**On Arc with ZeroDev Kernel:**
- Agent created in our DB → **Kernel address is computed counterfactually, NOTHING is on chain yet, zero gas**
- Funds deposited to that Kernel address → works fine on an un-deployed
  address (ERC-20 transfer doesn't care if the recipient has code yet)
- **First userOp from the Kernel** (whichever comes first: permission
  install OR first payment) → Kernel contract deploys + op executes,
  bundled into one userOp, **paymaster-sponsored**
- Every subsequent userOp → paymaster-sponsored

**Implications for our code:**
1. `POST /api/agents` should be **instant and free** — just derive the
   counterfactual Kernel address, store in DB, return. No on-chain call.
   Do NOT eagerly deploy the Kernel.
2. First time the agent needs to do something on-chain (install a
   session key OR send a payment), use `createKernelAccountClient`
   with the paymaster configured — the SDK handles "deploy if needed"
   by setting `initCode` on the userOp automatically.
3. `POST /api/agents/:id/permissions` is typically the **first userOp**,
   which means the Kernel deploy cost gets bundled into the paymaster-
   sponsored "install session key" call. One-liner for the pitch:
   "create agent, set a permission — no gas ever visible, the Kernel
   deploy piggybacks the permission install."
4. If the user creates an agent, funds it via crypto deposit, but
   never adds a permission — the Kernel simply stays un-deployed.
   Funds sit safely at the address. Zero gas wasted.
5. **Archive flow** must handle the un-deployed case: if the Kernel
   never deployed, there's nothing to revoke on chain. Just sweep the
   USDC balance back to the funder and mark archived. Check
   `publicClient.getBytecode({ address: kernelAddress })` — if
   `undefined`/`0x`, skip the revoke userOp.

**UX implications:**
- "Create agent" → instant, DB write only.
- "Create permission" → ~1s extra on the FIRST permission of an agent
  because the Kernel deploys in the same userOp. Subsequent permissions
  on the same agent are faster. Existing spinner copy is fine.

### 2. Stack swap (underneath only)

| Layer | Before (Tempo) | After (Arc) |
|---|---|---|
| Chain | Tempo 4217 | **Arc** (Circle L1) |
| Account | Native Tempo account | **ZeroDev Kernel v3** smart account |
| Owner auth | Turnkey sub-org + passkey | **ZeroDev passkey validator** (WebAuthn) |
| Scoped signer | TIP-1011 Access Key | **ZeroDev session keys** via `@zerodev/permissions` |
| Key material | Turnkey TEE | Browser passkey (owner) + ephemeral session keys |
| Gas | Rein gas tank | **ZeroDev paymaster** (USDC or sponsored) |
| Payment | USDC transfer on Tempo | USDC transfer on Arc |

Drop Turnkey entirely. Drop the gas-tank helper — paymaster replaces it.

### 3. Keep the security invariants that still apply
- Session key private material must be ephemeral — generated client-side
  for demo signing, OR stored server-side encrypted at rest (pick one,
  document the choice in `CLAUDE.md`). Do NOT return the raw session key
  to the UI except in the one-shot credentials modal.
- transferFrom bypass mitigation: if `approve` operation is enabled but
  payees list is empty, reject.
- Revoke = uninstall the session-key module from the Kernel account.

### 4. Scope for the hackathon (explicit non-goals)
- No Circle Nanopayments, no x402, no micropayments. Plain USDC transfer
  only. Micropayments are trivially added later.
- No CCTP / cross-chain. Arc only.
- No Circle Wallets SDK (ZeroDev passkey is sufficient and cleaner).
- No Turnkey. No TEE pitch. Passkey-only.
- No multi-admin quorum. Single passkey owner per company.
- No 24h timelock. Instant permission updates. (Mention in pitch as
  roadmap.)

---

## Reference docs (use these, not training data)

Before writing any ZeroDev / Kernel code, **WebFetch** these and work
from them. ZeroDev's API changed significantly in v3 and their session
key story moved from the old `@zerodev/session-key` package to
`@zerodev/permissions`. Training data is stale.

**ZeroDev core:**
- Overview: https://docs.zerodev.app/
- Kernel v3 intro: https://docs.zerodev.app/sdk/core-api/create-account
- Smart account client: https://docs.zerodev.app/sdk/core-api/using-smart-account
- Paymaster / gas sponsorship: https://docs.zerodev.app/sdk/core-api/sponsor-gas
- Pay gas in ERC-20 (USDC): https://docs.zerodev.app/sdk/core-api/pay-gas-in-erc20

**ZeroDev passkey owner:**
- Passkey validator: https://docs.zerodev.app/sdk/advanced/passkeys
- Package: `@zerodev/passkey-validator`

**ZeroDev session keys (the permission system we need):**
- Permissions overview: https://docs.zerodev.app/sdk/permissions/intro
- Creating a session key: https://docs.zerodev.app/sdk/permissions/quickstart-session-keys
- Policies (Call / Rate Limit / Sudo / Signature): https://docs.zerodev.app/sdk/permissions/policies
- Signers: https://docs.zerodev.app/sdk/permissions/signers
- Serializing / deserializing session keys: https://docs.zerodev.app/sdk/permissions/serialization

**Arc chain info (use these, not training data):**

Install the Circle skills plugin first — it packages the current Arc
config and will save guessing:
```
/plugin marketplace add circlefin/skills
/plugin install circle-skills@circle
```
Then use the `use-arc` skill for chain config, RPC, USDC-as-gas, and
contract addresses: https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md

**Key Arc facts to encode in `src/lib/arc.ts`:**
- Arc is **Testnet only right now** — use testnet RPC + testnet USDC.
- **USDC is the native gas token on Arc** (not ETH). This is important
  for paymaster config — ZeroDev's USDC-gas path on Arc is the native
  path, not an ERC-20 paymaster wrapper. If ZeroDev's paymaster on Arc
  just routes gas through USDC directly, we may not even need a
  separate paymaster client — confirm against ZeroDev's Arc support
  page before building.
- **Sub-second deterministic finality** — we can treat a tx as final
  after 1 confirmation. No need for multi-block waiting in the UI.
- **EVM compatible** but check differences: https://docs.arc.network/arc/references/evm-compatibility.md

**Arc reference pages:**
- Connect to Arc (RPCs, chain id): https://docs.arc.network/arc/references/connect-to-arc.md
- Contract addresses (USDC, EURC, CCTP, Gateway): https://docs.arc.network/arc/references/contract-addresses.md
- Gas and fees: https://docs.arc.network/arc/references/gas-and-fees.md
- Account abstraction providers on Arc: https://docs.arc.network/arc/tools/account-abstraction.md
- Block explorer: https://testnet.arcscan.app
- Faucet for testnet USDC: https://faucet.circle.com
- Sample apps: https://docs.arc.network/arc/references/sample-applications.md

**Account abstraction on Arc — check this page first:**
https://docs.arc.network/arc/tools/account-abstraction.md

It lists which bundlers + paymasters currently support Arc. If ZeroDev
is listed, use it. If not, the fallback is permissionless.js +
whichever bundler Arc's AA page endorses. **Read that page before
writing any bundler config.**

**ERC-8004 AI Agent identity (bonus pitch material):**
Arc has a native AI-agent registry (ERC-8004). Not required for the
MVP, but if there's time at the end, registering each agent's Kernel
address as an ERC-8004 identity is a cheap bonus feature that fits
directly into the "AI agent" bounty framing:
https://docs.arc.network/arc/tutorials/register-your-first-ai-agent.md

**Do NOT use on this build** (explicitly out of scope — listed so the
agent doesn't wander in and try to use them):
- App Kit Bridge / Swap / Send — we only need same-chain USDC transfer
  on Arc. No bridging.
- CCTP / Gateway — no cross-chain.
- Circle Wallets — we use ZeroDev passkey owner, not Circle Wallets.
- ERC-8183 jobs — different primitive, not relevant to spend control.

**permissionless.js (bundler client if ZeroDev bundler unavailable on Arc):**
- https://docs.pimlico.io/permissionless

**WebAuthn / passkeys primer** (for auth rewrite):
- https://webauthn.guide/ — conceptual
- The ZeroDev passkey validator already handles the ceremony; you
  shouldn't need raw WebAuthn APIs unless passkey-validator doesn't
  cover your flow.

**Critical API mappings (do NOT guess these):**

| Concept in our code | ZeroDev API |
|---|---|
| Create Kernel account with passkey owner | `createKernelAccount` + `toPasskeyValidator` |
| Smart account client (sends userOps) | `createKernelAccountClient` |
| Paymaster-sponsored userOp | `createZeroDevPaymasterClient` + `paymaster` field on kernel client |
| Install session key | `toPermissionValidator` + `createKernelAccount` with `plugins.regular` |
| Session key signer (ephemeral ECDSA) | `toECDSASigner` from `@zerodev/permissions/signers` |
| Call policy (contract + selector allow-list) | `toCallPolicy` from `@zerodev/permissions/policies` |
| Per-tx value cap | Use call policy `valueLimit` per call, OR sudo policy + server-side check |
| Rate limit (monthly cap approximation) | `toRateLimitPolicy` |
| Serialize session key for storage | `serializePermissionAccount` |
| Deserialize session key for signing | `deserializePermissionAccount` |
| Revoke session key | Uninstall validator / plugin |

If a mapping in that table turns out to be wrong when you read the
docs, **use the docs, not the table.** The table is a starting pointer,
not ground truth.

---

## Concrete changes

### Directory setup
```
cp -R /Users/nakatanishunsuke/Dev/Rein/rein-app /Users/nakatanishunsuke/Dev/Rein/rein-arc
cd /Users/nakatanishunsuke/Dev/Rein/rein-arc
rm -rf node_modules .next dev.db prisma/migrations
```

Update `package.json` name to `rein-arc`. Keep all UI deps. Remove
Turnkey packages (`@turnkey/*`). Add:
```
@zerodev/sdk
@zerodev/ecdsa-validator
@zerodev/passkey-validator
@zerodev/permissions
@zerodev/paymaster
permissionless
viem
```

### `src/lib/` — full rewrite of three files
Delete: `turnkey.ts`, `tempo.ts`, `gas-tank.ts`.
Create:

- `src/lib/arc.ts` — Arc chain config (RPC, bundler, paymaster URLs via
  ZeroDev project ID), USDC contract address on Arc, viem public client.

- `src/lib/kernel.ts` — helpers:
  - `createKernelAccountForAgent({ ownerPasskeyId, agentName })` →
    deploys Kernel v3 with passkey validator as owner, returns
    `{ kernelAddress, kernelClient }`. Paymaster sponsors deployment gas.
  - `installSessionKey({ kernelClient, scope })` → generates an
    ephemeral ECDSA session key, installs it with permission modules
    that enforce: Call Policy (USDC contract, allowed selectors),
    Value Limit Policy (per-payment cap in USDC units — remember 6
    decimals), Rate Limit Policy (approximate monthly cap as total
    value over 30-day rolling window), and if payees are set a
    Signature Policy or custom allow-list. Returns `{ sessionKeyId,
    sessionKeyAddress, sessionKeyPrivateKey, policyId }`.
  - `uninstallSessionKey({ kernelClient, sessionKeyId })` → revoke.
  - `sendFromAgent({ kernelClient, sessionKey, to, amountUsdc })` →
    USDC transfer, paymaster-sponsored.

- `src/lib/passkey.ts` — WebAuthn ceremony helpers (register + assert)
  that produce a passkey credential the ZeroDev passkey validator
  accepts. Use the `@zerodev/passkey-validator` APIs directly; do not
  roll our own WebAuthn.

Keep: `activity.ts`, `agents.ts`, `auth.ts`, `db.ts`, `utils.ts`
(update internals only).

### Prisma schema
Rename Tempo/Turnkey fields to chain-agnostic names:

```prisma
model User {
  id                  String   @id @default(cuid())
  email               String   @unique
  companyName         String
  passkeyCredentialId String   @unique   // WebAuthn credential id
  passkeyPublicKey    String              // COSE public key
  createdAt           DateTime @default(now())
  agents              Agent[]
  sessions            Session[]
}

model Agent {
  id                 String       @id @default(cuid())
  userId             String
  user               User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name               String
  // Kernel smart account address on Arc. Server-only, never rendered.
  accountAddress     String       @unique
  status             String       // active | paused | archived
  createdAt          DateTime     @default(now())
  archivedAt         DateTime?
  permissions        Permission[]
  payees             Payee[]
  transactions       Transaction[]
  @@index([userId])
}

model Permission {
  id                  String    @id @default(cuid())
  agentId             String
  agent               Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  name                String
  // ZeroDev session key identifier (module address + key id).
  sessionKeyId        String
  // Session key EVM address. Server-only.
  sessionKeyAddress   String
  // Session key private key, encrypted at rest with APP_ENCRYPTION_KEY.
  // Returned ONCE on creation and never again. For the hackathon demo
  // we store the ciphertext so the UI can show "rotate" later.
  sessionKeyCiphertext String?
  scope               String    // JSON: { mode, perTxCapUsd, monthlyCapUsd, payeeIds, allowedOperations }
  status              String
  installTxHash       String?
  revokeTxHash        String?
  createdAt           DateTime  @default(now())
  revokedAt           DateTime?
  @@index([agentId])
}

// Payee and Transaction: same as rein-app, unchanged.
```

Run a fresh migration — no data to preserve.

### API routes
Keep every route path. Keep every request body schema. Keep every
response shape the UI currently consumes. Internals swap.

- `POST /api/agents` → deploy a Kernel smart account for this agent
  (paymaster-sponsored), optionally seed with an initial on-ramp top-up
  in the same flow if `initialBudgetUsd` is set. No company-level
  account is ever deployed.
- `POST /api/agents/:id/topup` → server-side mock on-ramp that credits
  this specific agent (see funding flows below). Direct crypto deposits
  go straight to the agent's Kernel address — no top-up API call
  needed; balance polling surfaces the incoming funds.

### Funding flows — per-agent, NO company treasury

**There is no company-level account.** Money only ever lives in agent
Kernel accounts. Every funding affordance is scoped to a specific
agent and lives on that agent's detail page (`/dashboard/agents/[id]`).
Two funding paths per agent:

**Option 1: Fiat on-ramp (mocked for the hackathon demo)**
- UI: "Add funds" button on the agent detail page → modal styled like
  a checkout form: "Amount (USD)" + fake card-number / Apple-Pay fields
  + "Add funds" button.
- Backend: `POST /api/agents/:id/topup` with `{ amountUsd }`. Server
  uses a pre-funded faucet EOA (`REIN_ONRAMP_FUNDER_PRIVATE_KEY`) to
  send test USDC directly to this agent's Kernel address.
- UI shows spinner → success toast → agent balance updates.
- Document in code comments that this is a demo mock of what will
  become a real Stripe/Circle fiat on-ramp in production.
- **No blockchain vocabulary leaks.** User sees "Adding funds…" then
  "$500 added to [agent name]."

**Option 2: Direct crypto deposit (the one allowed address surface)**
- UI: "Deposit crypto" tab inside the same funding modal → shows the
  **agent's Kernel address** as copyable string + QR code + one line
  "Send USDC on Arc to this address. Funds appear within seconds."
- This is the **one and only place** in the UI where a raw address is
  rendered. Justification: the user is explicitly moving crypto in
  from another wallet, so crypto vocabulary is acceptable and necessary.
- Backend: `GET /api/agents/:id` already returns the Kernel address
  internally; expose it as `depositAddress` on the agent detail
  response ONLY when this modal is open (or just always — it's the
  agent's own address, no cross-agent leak risk).
- Poll agent balance every 5s while the deposit modal is open.

Both options credit the same on-chain agent balance. No funds ever
move "company → agent"; funds land on the agent directly.

**Env var addition:**
```
REIN_ONRAMP_FUNDER_PRIVATE_KEY=0x...   # faucet EOA for the mock on-ramp
REIN_ONRAMP_FUNDER_ADDRESS=0x...
```

**Archive semantics update:** `POST /api/agents/:id/archive` — revokes
all permissions, then sweeps remaining USDC from the agent's Kernel
back to `REIN_ONRAMP_FUNDER_ADDRESS` (treating it as the "return-to-
sender" sink for the demo). Mark archived. In production this would
sweep back to a company-level account or off-ramp — flag as a TODO.
- `POST /api/agents/:id/permissions` → install session key, return
  `{ apiKeyId, apiSecret }` once (the session key address + private key,
  labeled as user-friendly names).
- `POST /api/agents/:id/permissions/:permId/revoke` → uninstall module.
- `POST /api/agents/:id/payees` → unchanged (DB only).
- `POST /api/agents/:id/archive` → revoke all permissions, sweep balance
  back to treasury, mark archived.
- `POST /api/payments` → used by the agent-runtime demo; takes an api
  secret (session key private key) + payment details, signs userOp,
  submits via bundler, paymaster pays gas.

### Auth
Replace Turnkey sub-org creation with a direct WebAuthn ceremony:
- Sign-up: generate passkey challenge server-side, verify attestation,
  store `passkeyCredentialId` + `passkeyPublicKey` on User.
- Login: WebAuthn assertion, verify against stored pubkey, issue
  Session row.
- Admin mutations (create permission, revoke): require a fresh
  WebAuthn assertion per mutation. Reuse `login-form` ceremony UX for
  the re-auth modal.

### Env vars
`.env.example`:
```
DATABASE_URL="file:./dev.db"
ARC_RPC_URL=
ARC_CHAIN_ID=
ZERODEV_PROJECT_ID=
ZERODEV_BUNDLER_URL=
ZERODEV_PAYMASTER_URL=
USDC_CONTRACT_ARC=0x...
REIN_TREASURY_PRIVATE_KEY=0x...
REIN_TREASURY_ADDRESS=0x...
APP_ENCRYPTION_KEY=   # 32-byte hex, for session-key ciphertext at rest
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Document in README: Arc chain id + RPC source, how to get a ZeroDev
project id, how to fund the treasury EOA with testnet USDC.

### CLAUDE.md
Append "Arc build invariants":
1. Same three-layer model.
2. Same UI vocabulary ban (extend with `Kernel`, `ZeroDev`, `Arc`,
   `session key`, `Circle`).
3. Session key private material is shown once, stored encrypted with
   `APP_ENCRYPTION_KEY`, never logged.
4. Paymaster sponsors all user-facing gas. Treasury EOA funds
   agent top-ups.
5. Every admin mutation requires a fresh passkey assertion.

### Smoke test (`scripts/smoke.ts`)
1. Register passkey (mock ceremony fine for the script).
2. Create agent with $100 initial budget → verify Kernel deployed +
   balance on chain.
3. Create payee, create permission $10/tx $50/mo open mode.
4. Use returned api secret to POST a $5 payment → verify on chain.
5. Try an $11 payment → verify blocked by session-key validator.
6. Revoke permission → verify next payment fails.
7. Grep rendered pages for banned vocab. Fail if found.

---

## Execution order
1. Clone repo to `rein-arc`, clean install deps.
2. Schema migration.
3. `src/lib/arc.ts`, `src/lib/kernel.ts`, `src/lib/passkey.ts`.
4. Auth rewrite (WebAuthn direct).
5. API route internals.
6. Verify UI unchanged — `diff -qr ../rein-app/src/components src/components`
   should be empty except for removed Tempo-specific imports inside
   components. Any user-visible diff is a bug.
7. Smoke test.
8. README: one-paragraph pitch, setup steps, demo script.

## Done when
- [ ] `npm run build` clean.
- [ ] Landing page byte-identical to `rein-app`.
- [ ] Dashboard renders identically — same copy, same layout.
- [ ] No banned vocabulary anywhere user-visible.
- [ ] Smoke test passes on Arc testnet.
- [ ] Demo: create agent → create permission → send payment → revoke →
      blocked. All in under 90 seconds on camera.

Start by cloning the repo, then write a short plan for which files you
will touch and confirm with me before the first destructive change.
