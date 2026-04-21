@AGENTS.md

## Invariants

These hold across the codebase. Violating any is a product-defining or
security bug; do not relax without explicit approval.

### 1. UI vocabulary ban

The following words/strings MUST NOT appear anywhere in user-visible UI
(page copy, form labels, toast messages, dialog text, table headers, error
messages, placeholder text, or aria labels):

`wallet`, `address`, `chain`, `Tempo`, `USDC`, `ETH`, `gas`, `signer`,
`session key`, `Access Key`, `sub-org`, `Turnkey`, `Kernel`, `ZeroDev`,
`Arc`, `Circle`, `0x…`, `tx hash`, `block explorer`, `transaction hash`,
`signature`, `private key`, `public key`, `EOA`, `smart account`,
`selector`, `hex`, `userOp`, `user operation`, `paymaster`, `bundler`,
`passkey` (except on the sign-in surface below).

Allowed product vocabulary: **Company, Agent, Permission, Balance,
Top up, Add funds, Deposit, Payee, Per-payment limit, Monthly limit,
Spent, Remaining, Activity, Revoke, Pause, Archive, Credentials, API
key ID, API secret.**

**Exceptions (the only ones):**
- `src/app/page.tsx` (landing) + `src/components/hero.tsx` +
  `src/components/agent-chat-demo.tsx` — marketing surface. Generic
  crypto nouns like "programmable wallet" and "cryptography" are OK
  here; product-internal jargon (`Tempo`, `USDC`, `Turnkey`, `Kernel`,
  `ZeroDev`, `Arc`, `sub-org`, `tx hash`, `private key`, `Access Key`,
  `EOA`, `hex`) must still NEVER appear. Signed-in visitors are
  redirected to `/dashboard` — the ban below applies from there on.
- `src/components/login-form.tsx` — the sign-in / sign-up surface uses
  "passkey" because the platform WebAuthn prompt uses that word; users
  expect it here and nowhere else.
- `src/components/credentials-modal.tsx` — displays the one-shot API
  keypair. Labels are "API key ID" / "API secret" / "Organization ID",
  never "public key" / "private key".
- `src/components/payee-form.tsx` — the address-entry input. After the
  payee is saved the address is stored server-side and NEVER rendered
  back to the UI.
- `src/components/agent-deposit-panel.tsx` — the "Deposit" tab reveals
  a specific agent's deposit address ONLY after the customer clicks
  "Reveal deposit address" inside the funding dialog. The address is
  fetched from `/api/agents/:id/deposit-address` which is the only
  route permitted to return an agent's account address. Closing the
  dialog re-hides the address so every reveal is an explicit customer
  action.

### 2. Three-layer model

```
User (Company)   → 1 WebAuthn passkey (registered at signup)
                   Auth/signing boundary only. No user-visible balance.
  └── Agent      → 1 ZeroDev Kernel v3 smart account on Arc
                   Holds its own balance; its own deposit address;
                   funded directly (Add funds or Deposit).
       ├── Payee      → server-only (address, label). UI shows label only.
       └── Permission → 1 ZeroDev session-key plugin installed on the
                        agent's Kernel with call + rate-limit policies.
                        Its private key is returned ONCE as the API secret.
```

There is intentionally **no** Company-level balance pool in the UI. Each
Agent is funded directly — either via the mock fiat on-ramp (Add funds
tab) or by sending stable to its own deposit address (Deposit tab).
Rebalancing between agents is an external operation.

### 3. Gas is sponsored; agents never see it

The ZeroDev paymaster pays for every user-operation: Kernel deployment,
session-key installation, payment sends, and uninstallation on revoke.
The agent never holds a gas token — on Arc the native token is USDC, and
agents hold only the customer's funded balance.

Consequences:
- Displayed balance = on-chain balance read of the agent's account.
- Rein operator must keep the ZeroDev paymaster funded.
- Never expose gas to the UI. Never show a "fund for gas" flow.
- Never show a "deployed yet?" state — deployment happens implicitly on
  the first session-key install and is invisible to the customer.

### 4. Security invariants

- **Kernel owner key is encrypted at rest.** Every Agent row stores a
  unique ECDSA private key as `ownerCiphertext`, encrypted with
  AES-256-GCM under `APP_ENCRYPTION_KEY`. The plaintext only exists in
  memory, during a request, long enough to install or revoke a
  permission. Never log it. Never return it.
- **Session-key private key is ONE-SHOT.** On permission creation we
  return the session-key private key as `apiSecret` and never persist
  it in plaintext. The server stores the *serialized permission
  account* (policy structure, no private key) encrypted at rest; the
  runtime `/api/payments` path requires the caller to present the
  `apiSecret` on every request so a DB compromise alone cannot sign.
- **On-chain policy enforcement.** Each Permission installs a ZeroDev
  permission validator with a CallPolicy (target = USDC, selector =
  transfer, arg2 < perPaymentLimit) and a RateLimitPolicy (approx.
  monthly cap over a 30-day window). The bundler rejects any userOp
  that violates the policies. Additionally `/api/payments` checks the
  per-tx cap in app code as defense in depth.
- **`transferFrom` bypass mitigation.** If `allowedOperations`
  includes `approve_vendor` but the permission has zero payees,
  `POST /api/agents/:id/permissions` rejects with 400.

#### Hackathon shortcut — owner validator is ECDSA, not passkey

The prompt's long-term design calls for each Kernel's sudo validator to
be a WebAuthn passkey with per-signature user verification. To keep the
install/revoke path inside a server route (which can't invoke the
browser WebAuthn API), we instead generate an ECDSA owner key per agent
and encrypt it under `APP_ENCRYPTION_KEY`. The customer's passkey still
gates the session (via `/api/auth/login`) — but it does not sign
individual userOps. Moving to a passkey-owner Kernel is a known
follow-up; see `src/lib/kernel.ts` header for the shape.

### 5. No address or tx-hash leakage in responses

API response bodies that reach the client MUST NOT include:
- Any field matching `/0x[0-9a-fA-F]{40,}/` (addresses, tx hashes).
- Raw `accountAddress`, `sessionKeyAddress`, `installTxHash`,
  `revokeTxHash`, `ownerCiphertext` from Prisma rows. Strip before
  returning; use `summarizeAgent()` / explicit response shapes.

The only exceptions are:
- `POST /api/agents/:id/permissions` — the one-shot credentials
  response includes `apiSecret` (the session-key private key).
- `GET /api/agents/:id/deposit-address` — the opt-in reveal gated by
  the Deposit tab of `AgentDepositPanel`.

## Where the security code lives

| Concern | File |
| --- | --- |
| Chain + paymaster config | `src/lib/arc.ts` |
| At-rest encryption (AES-256-GCM) | `src/lib/encryption.ts` |
| WebAuthn register / authenticate verification | `src/lib/passkey.ts` |
| Kernel account + session-key install / revoke / payment | `src/lib/kernel.ts` |
| Mock fiat on-ramp (ERC20 transfer from funder EOA) | `src/lib/onramp.ts` |
| Session cookie + WebAuthn challenge cookie handling | `src/lib/auth.ts` |
| Signup (verify registration → create User) | `src/app/api/auth/signup/route.ts` |
| Signin (verify assertion → issue session) | `src/app/api/auth/login/route.ts` |
| Agent create (derive Kernel, encrypt owner) | `src/app/api/agents/route.ts` |
| Permission install (one-shot credentials response) | `src/app/api/agents/[id]/permissions/route.ts` |
| Permission revoke | `src/app/api/agents/[id]/permissions/[permId]/revoke/route.ts` |
| Agent archive + optional sweep | `src/app/api/agents/[id]/archive/route.ts` |
| Agent top-up (mock fiat) | `src/app/api/agents/[id]/topup/route.ts` |
| Runtime payment endpoint | `src/app/api/payments/route.ts` |
| Opt-in deposit-address reveal | `src/app/api/agents/[id]/deposit-address/route.ts` |
| Show-once credentials UI | `src/components/credentials-modal.tsx` |
| Funding modal (fiat + crypto tabs) | `src/components/agent-deposit-panel.tsx` |
