# Operator guide

Internal-facing. Covers env shape, the boot-time contract presence
check, and the workflow for bringing Rein up on a new chain.

## Architecture pointers

- Chain config: [`src/lib/chain.ts`](./src/lib/chain.ts) — every chain-
  dependent value is sourced from env. No hard-coded chain.
- Contract presence check: [`src/lib/chain-presence.ts`](./src/lib/chain-presence.ts)
  — runs once per server process, refuses to start when required
  contracts are missing on the configured chain.
- Kernel + permission install / runtime: [`src/lib/kernel.ts`](./src/lib/kernel.ts)
  — uses ZeroDev Kernel v3.1 + permission session keys (CallPolicy +
  RateLimitPolicy).

## Env shape

```bash
# Database
DATABASE_URL="file:./dev.db"   # or file:/data/dev.db on Railway

# Chain (every value below required)
CHAIN_ID="84532"
CHAIN_NAME="Base Sepolia"
CHAIN_RPC_URL="https://sepolia.base.org"
EXPLORER_URL="https://sepolia.basescan.org"

# Stable token (ERC-20)
STABLE_CONTRACT="0x..."         # token address on the chain above
STABLE_SYMBOL="USDC"
STABLE_DECIMALS="6"

# ZeroDev (single project ID; bundler/paymaster URLs are derived)
ZERODEV_PROJECT_ID="..."

# Rate-limit policy variant
#   auto         use the rolling-window contract if it's deployed,
#                otherwise fall back to a lifetime count cap.
#   with-reset   require the rolling-window contract; refuse to install
#                if it isn't deployed.
#   lifetime    always use the lifetime count cap.
RATE_LIMIT_VARIANT="auto"

# Passkey
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_RP_NAME="Rein"

# At-rest encryption (32-byte hex)
APP_ENCRYPTION_KEY="..."
```

The bundler and paymaster URLs are not separate env entries. They are
derived at runtime as
`https://rpc.zerodev.app/api/v3/{ZERODEV_PROJECT_ID}/chain/{CHAIN_ID}`.

## ZeroDev project setup

1. Create or open a project at <https://dashboard.zerodev.app/>.
2. Enable the chain you set in `CHAIN_ID` for the project.
3. Configure the project's gas policy / paymaster to sponsor calls from
   your project. Every server-side userOp (Kernel deployment,
   permission install, payment send, revoke) is paid for by the
   paymaster — agents never hold a gas token.
4. Copy the project ID into `ZERODEV_PROJECT_ID`. Same project ID
   across every chain you target.

Cross-reference: ZeroDev's chain support is documented at
<https://docs.zerodev.app/sdk/faqs/chains>.

## Boot-time contract presence check

On first import of `chain.ts` the server runs a memoised
`eth_getCode` check against:

- `STABLE_CONTRACT`
- `CALL_POLICY_CONTRACT_V0_0_5`
- `RATE_LIMIT_POLICY_CONTRACT`
- `RATE_LIMIT_POLICY_WITH_RESET_CONTRACT` (optional)
- Kernel v3.1 implementation address
- ECDSA validator address

Behaviour:

- Stable contract missing → throw, refuse to start.
- `CALL_POLICY_CONTRACT_V0_0_5` missing → throw, refuse to start (no
  payments possible).
- Both rate-limit policies missing → throw, refuse to start.
- Only the with-reset variant missing → log a warning, fall back to
  the lifetime cap regardless of `RATE_LIMIT_VARIANT=auto`.
- Kernel impl or ECDSA validator missing → throw, refuse to start.

This is what would have caught the WITH_RESET bug at startup instead
of in production. The check is cached for the lifetime of the server
process; restart the server after switching chains.

## Bringing up a new chain — checklist

1. Confirm ZeroDev supports the chain (<https://docs.zerodev.app/sdk/faqs/chains>).
2. Find the stable token address on that chain (e.g. Circle USDC).
3. Fill in the env vars above.
4. Add the chain to your ZeroDev project and configure its gas policy.
5. `npm run dev`. Watch the logs for the `[chain-presence]` line —
   it lists which policy contracts were found on the configured chain.
6. Run the end-to-end smoke test:
   - Create an agent + payee + permission via the local dashboard.
   - Send a $1 payment via the Node demo (back-to-back × 2 to confirm
     the rate-limit policy doesn't lock you out).
   - Confirm the payment landed via the configured `EXPLORER_URL`.

## Verifying a contract on a chain

```bash
curl -s -X POST <CHAIN_RPC_URL> \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["<addr>","latest"]}'
```

A non-`"0x"` `result` means the contract is deployed.

## Known caveats

- **First payment latency**: the first userOp on a fresh agent bundles
  Kernel deployment, permission install, and the transfer in one user
  operation. Expect 20–40s. Subsequent calls are 3–5s. SDK clients
  ship with 200s+ timeouts for this reason; don't reduce them.
- **`Already known` from the bundler**: if a userOp is retried while
  the first is still in the mempool, the server maps that to
  `PERMISSION_CAP_EXCEEDED`. Don't add aggressive retry logic without
  nonce coordination.
- **Payee normalization**: payee addresses are stored lowercased and
  compared case-insensitively. Don't change this without checking
  every comparison site.
