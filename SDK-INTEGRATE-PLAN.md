# Rein SDK + Dashboard "Integrate" Section — Implementation Plan

Paste into a fresh Claude Code session inside
`/Users/nakatanishunsuke/Dev/Rein/Rein-Arc`.

---

## Filesystem access

- **Read access**: everything under `/Users/nakatanishunsuke/Dev/Rein/`.
  Use `rein-app` as a UI/API reference.
- **Write access**: ONLY inside `/Users/nakatanishunsuke/Dev/Rein/Rein-Arc/`.
  Do not modify anything outside that directory.

---

## Goal

Two additions to the existing Rein-Arc app:

1. **A minimal `@rein/sdk` package** inside the monorepo at
   `Rein-Arc/packages/sdk/` that gives customers a one-line way to send
   payments from an agent permission.
2. **An "Integrate" tab on each permission's detail page** in the
   dashboard that shows copy-paste installation and usage snippets
   scoped to that specific permission, plus a "Send test payment"
   button to verify the integration end-to-end.

Both are minimal. Hackathon-grade, not production-published. The SDK
source lives in the repo; judges see it by reading the Integrate tab.

---

## Hard rules

### 1. Keep the UI vocabulary ban
The Integrate tab is the **second** allowed carve-out in the UI
vocabulary ban (the first was the crypto deposit address on the
funding modal). Integrate is allowed to show:

- The API key string
- The npm package name (`@rein/sdk`)
- The word "endpoint" in the code snippet
- The Rein API base URL (our own service, not a chain URL)

It is still NOT allowed to show:
- A chain name (Arc, Tempo)
- A wallet or smart account address
- A session key in its raw private-key form (we expose it AS the API key, labeled "API key", never "private key" or "session key")
- Gas, userOps, or any blockchain vocabulary

### 2. Don't publish to npm (yet)
For the hackathon, the SDK lives in the repo at `packages/sdk/`. The
dashboard shows an install command that uses a local tarball or a
GitHub install URL. Real npm publish can happen post-hackathon.

Install command shown in the UI should be:
```
npm install github:Shunsuke0401/Rein-Arc#main --workspace=@rein/sdk
```
OR if that's awkward, just show:
```
npm install @rein/sdk
```
and note in the README that this will go live post-hackathon. Pick
whichever is simpler to demo.

### 3. API stays auth-gated
Every SDK call hits an authenticated endpoint. The SDK sends
`Authorization: Bearer <apiKey>` where `apiKey` is the session-key
credential issued at permission creation. The server looks up the
permission by apiKey, loads the session key from
`sessionKeyCiphertext`, decrypts, and signs the userOp. SDK does no
signing.

---

## Part 1 — The SDK package

### Location
`Rein-Arc/packages/sdk/`

Set up as an npm workspace in the root `package.json`:
```json
{
  "workspaces": ["packages/*"]
}
```

### Package shape
```
packages/sdk/
├── package.json          # name: "@rein/sdk", type: "module"
├── tsconfig.json
├── src/
│   ├── index.ts          # exports Rein class + types
│   ├── client.ts         # Rein class
│   ├── resources/
│   │   ├── payments.ts
│   │   └── agent.ts
│   └── types.ts
└── README.md             # short, copy-paste examples
```

### API surface (v0.1 — keep tiny)
```ts
import { Rein } from "@rein/sdk";

const rein = new Rein({
  apiKey: process.env.REIN_API_KEY!,
  // baseUrl is baked in; only override for self-hosting:
  // baseUrl: "https://rein-arc-production.up.railway.app",
});

// 1. Send a payment
const payment = await rein.payments.create({
  to: "vendor-stripe",   // payee label OR raw address for open-mode permissions
  amountUsd: 50,
  note: "weekly stripe payout",   // optional, stored server-side
});
// → { id, status, amountUsd, to, createdAt }

// 2. Check agent status
const status = await rein.agent.status();
// → {
//     name, balanceUsd, spentThisMonthUsd,
//     perPaymentLimitUsd, monthlyLimitUsd, remainingMonthlyUsd,
//     status: "active" | "paused" | "revoked"
//   }

// 3. List payees the permission is allowed to pay
const payees = await rein.agent.payees();
// → [{ label, id }, ...]   (never returns raw addresses)

// 4. Recent activity
const activity = await rein.agent.activity({ limit: 10 });
// → [{ timestamp, direction, counterpartyLabel, amountUsd, status }, ...]
```

### Behavior
- All methods `await fetch()` against the Rein API with
  `Authorization: Bearer ${apiKey}`.
- Typed request/response shapes live in `types.ts`.
- Errors: SDK throws a `ReinError` with `code`, `message`, `status`,
  and `requestId`. Distinguish at minimum:
  - `PERMISSION_CAP_EXCEEDED` (smart account would reject)
  - `PAYEE_NOT_ALLOWED` (closed-mode permission, payee not in list)
  - `INVALID_API_KEY` (401)
  - `NOT_FOUND` (404)
  - `INTERNAL` (500)
- No retries by default. Single request, fail fast.
- Default timeout 30s.
- No signing in the SDK. Server holds the session key.

### Base URL
Hard-code in `client.ts`:
```ts
const DEFAULT_BASE_URL = "https://rein-arc-production.up.railway.app";
```
Overridable via `new Rein({ apiKey, baseUrl })`.

### README (short)
Two code blocks — install + send a payment — plus a link back to the
dashboard Integrate tab for the user's actual API key.

---

## Part 2 — Server endpoints for the SDK

Add or adapt in `src/app/api/`:

### `POST /api/v1/payments`
- Auth: `Authorization: Bearer <apiKey>` where apiKey is the session
  key credential issued at permission creation.
- Body: `{ to: string, amountUsd: number, note?: string }`
- Server resolves `to`:
  - If closed-mode permission: must match a payee label → resolve to
    that payee's stored address.
  - If open-mode permission: accept raw EVM address string; reject if
    not a valid address.
- Server-side checks (pre-flight before submitting userOp):
  1. Permission status = active
  2. Amount ≤ perPaymentLimitUsd
  3. Amount + spentThisMonth ≤ monthlyLimitUsd
  4. If closed mode and payee resolves, continue; else reject with
     `PAYEE_NOT_ALLOWED`
- Load `sessionKeyCiphertext`, decrypt with `APP_ENCRYPTION_KEY`,
  deserialize permission account, submit userOp via ZeroDev kernel
  client. Paymaster sponsors gas.
- Record a `Transaction` row with `status: "pending"`, update to
  `"confirmed"` on receipt, `"failed"` on revert.
- Response shape matches SDK expectations (see above).

### `GET /api/v1/agent`
Returns `{ name, balanceUsd, spentThisMonthUsd, perPaymentLimitUsd,
monthlyLimitUsd, remainingMonthlyUsd, status }` for the permission's
agent. Never returns an address.

### `GET /api/v1/agent/payees`
Returns `[{ id, label }]`. Labels only. If permission is open-mode,
return an empty list and set `mode: "open"` in the response.

### `GET /api/v1/agent/activity?limit=10`
Returns normalized activity list as specified in the main prompt —
no hashes, no addresses, only labels and amounts.

### Auth middleware
Write `src/lib/sdk-auth.ts` that:
- Reads `Authorization: Bearer <apiKey>` header
- Looks up `Permission` by apiKey (hashed lookup — we should have stored
  a SHA-256 hash of the apiKey alongside the ciphertext at creation
  time for O(1) lookup; if not, add it now via migration)
- Attaches `{ permission, agent }` to the request
- Returns 401 on miss

---

## Part 3 — Dashboard Integrate tab

### Where
On the **permission detail view** inside `/dashboard/agents/[id]`.
Currently the agent detail page has three tabs (Overview, Permissions,
Payees). Permissions is a list; clicking a permission already opens
either a modal or a drawer (confirm current UX). Inside that
per-permission view, add the new tab **Integrate**, next to the
existing permission overview / revoke actions.

If the current UX only has a list with inline revoke (no drill-down),
create a dedicated route:
`/dashboard/agents/[id]/permissions/[permissionId]`
with tabs: **Overview**, **Integrate**, **Activity**.

### Integrate tab layout

```
Integrate this permission
─────────────────────────────────────────

 1  Install
    ┌────────────────────────────────────┐
    │ npm install @rein/sdk    [Copy]    │
    └────────────────────────────────────┘

 2  Set your API key
    ┌────────────────────────────────────┐
    │ REIN_API_KEY=sk_live_••••••••      │
    │                    [Reveal] [Copy] │
    └────────────────────────────────────┘
    Only shown once on permission creation.
    If lost, rotate the permission from Overview.

 3  Send a payment
    [Node.js]  [Python]  [cURL]
    ┌────────────────────────────────────┐
    │ import { Rein } from "@rein/sdk";  │
    │                                    │
    │ const rein = new Rein({            │
    │   apiKey: process.env.REIN_API_KEY │
    │ });                                │
    │                                    │
    │ await rein.payments.create({       │
    │   to: "stripe-payouts",            │
    │   amountUsd: 50,                   │
    │ });                   [Copy all]   │
    └────────────────────────────────────┘

 4  Verify
    ┌────────────────────────────────────┐
    │ Send a $1 test payment to          │
    │ [first payee label ▼]  [Send →]    │
    │                                    │
    │ ✓ Sent. See it in Activity.        │
    └────────────────────────────────────┘
```

### Language tabs
- **Node.js** — the canonical example shown above
- **Python** — use `httpx` or `requests`, direct REST call (no Python
  SDK to ship in v0.1; mention "Python SDK coming soon" in a subtle
  note). Show:
  ```python
  import os, httpx
  r = httpx.post(
      "https://rein-arc-production.up.railway.app/api/v1/payments",
      headers={"Authorization": f"Bearer {os.environ['REIN_API_KEY']}"},
      json={"to": "stripe-payouts", "amountUsd": 50},
  )
  print(r.json())
  ```
- **cURL** — the shell version of the same request

### Example values
Use the **first payee of this permission** as the `to` example if any
exist; otherwise use the literal string `"a-payee-label"` with a small
hint "add a payee first to see a real example."

### "Send test payment" button
Fires `POST /api/v1/payments` server-to-server, using this permission's
API key, from the dashboard. Amount: $1 (or the permission's
perPaymentLimitUsd if lower). Recipient: first payee of this
permission, or show a one-time picker if open-mode.

After success:
- Green checkmark
- "See it in Activity" link that jumps to the Activity tab
- Re-enable button after 5s so judges/customers can hit it a few times

After failure:
- Red message surfacing the API error `code` and `message`
- Link to docs (even a stub is fine for the hackathon)

### API key reveal
The API key value comes from the one-shot creation response and was
already shown once in the credentials modal. We don't store it in
plaintext. So in the Integrate tab:
- If the user just created this permission in this session and the
  credentials are still in client-side state → show real value with
  Reveal button.
- Otherwise → show masked `sk_live_••••••••` with a link "Rotate to
  get a new key" that fires a permission rotation (create new session
  key on same agent + revoke old one). Rotation is post-hackathon
  if it blows scope — for MVP, just show the masked value with a
  "You saved this at creation" note.

Pick the simpler path for the hackathon: the Integrate tab shows
MASKED key with a note saying "Saved at creation. Rotate to generate
a new one (coming soon)." Only show the real key during the initial
creation flow's credentials modal.

---

## Part 4 — Docs page (optional polish)

Add `/docs` route in the app (or link to a README) with:
- Quickstart (3 steps)
- API reference for all four SDK methods
- Error codes table
- "How limits work" — 3 bullets explaining per-payment, monthly,
  allow-list behavior

Keep it under 300 lines of markdown rendered with a simple MDX or
plain markdown renderer. This is polish, not blocking. Skip if time
is tight.

---

## Execution order

1. Monorepo setup: convert root `package.json` to workspaces, create
   `packages/sdk/`.
2. SDK package skeleton + `Rein` class + four methods, all typed.
3. Server: add `/api/v1/*` routes + `sdk-auth.ts` middleware.
   Migrate schema to add `apiKeyHash` column on `Permission` if not
   present.
4. Dashboard: Integrate tab component + language switcher + example
   snippet generator that interpolates the actual permission's first
   payee label.
5. "Send test payment" button wired to `/api/v1/payments`.
6. README in `packages/sdk/` with the install + first-payment example.
7. Optional: `/docs` page.
8. Smoke test: from the dashboard, hit "Send test payment" → verify a
   new row in Activity with status "confirmed", and balance drops by
   $1. Verify that the SDK example in the Integrate tab, when
   copy-pasted into a local Node script with the API key env var,
   produces the same result.

---

## Definition of done

- [ ] `npm run build` clean, both for the Next.js app and the SDK
      package.
- [ ] SDK exports `Rein` class with four methods, all typed.
- [ ] `/api/v1/payments`, `/api/v1/agent`, `/api/v1/agent/payees`,
      `/api/v1/agent/activity` all live and auth-gated.
- [ ] Integrate tab renders with real permission's example values.
- [ ] "Send test payment" button works end-to-end.
- [ ] No banned vocabulary in the Integrate tab (audit manually).
- [ ] README in `packages/sdk/` is copy-paste runnable.

---

## What's explicitly out of scope

- Publishing to npm (post-hackathon).
- Python / Go / Rust SDK packages.
- Webhooks for payment confirmations.
- API key rotation UI (stub with "coming soon").
- Client-side userOp signing in the SDK (server-side stays for v0.1).
- OAuth-style API key scopes beyond what the session key already enforces.
- Rate limit dashboard UI.

---

Start by reading the current state of `Rein-Arc/src/app/api`,
`Rein-Arc/src/app/(app)/dashboard/agents/[id]`, and
`Rein-Arc/prisma/schema.prisma`. Then write a short plan of the files
you will touch and confirm with me before creating the monorepo
workspace (it's the only structural change that's hard to undo).
