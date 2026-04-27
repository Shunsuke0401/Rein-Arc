// Runtime chain configuration. The chain, stable token, ZeroDev project, and
// rate-limit policy variant are all driven by env. Switching between Base,
// Optimism, Polygon, Ethereum, etc. requires only a different env file.
//
// All values are required at boot — there are no chain-specific defaults.
// A separate boot-time presence check (chain-presence.ts) verifies that the
// configured token contract and the ZeroDev policy contracts actually exist
// on the configured chain before the server accepts traffic.

import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  parseUnits,
  type Address,
} from "viem";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const CHAIN_ID = Number(requireEnv("CHAIN_ID"));
export const CHAIN_NAME = requireEnv("CHAIN_NAME");
export const CHAIN_RPC_URL = requireEnv("CHAIN_RPC_URL");
export const EXPLORER_URL = requireEnv("EXPLORER_URL");

export const STABLE_ADDRESS = requireEnv("STABLE_CONTRACT") as Address;
export const STABLE_SYMBOL = requireEnv("STABLE_SYMBOL");
export const STABLE_DECIMALS = Number(requireEnv("STABLE_DECIMALS"));

export const ZERODEV_PROJECT_ID = requireEnv("ZERODEV_PROJECT_ID");

// Bundler + paymaster share the same v3 endpoint and are derived from the
// project id and chain id. Don't require separate env entries — adding a new
// chain to a ZeroDev project never changes this URL pattern.
const ZERODEV_RPC_URL =
  `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${CHAIN_ID}`;
export const ZERODEV_BUNDLER_URL = ZERODEV_RPC_URL;
export const ZERODEV_PAYMASTER_URL = ZERODEV_RPC_URL;

export type RateLimitVariant = "auto" | "with-reset" | "lifetime";
export const RATE_LIMIT_VARIANT: RateLimitVariant =
  (process.env.RATE_LIMIT_VARIANT as RateLimitVariant | undefined) ?? "auto";

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: {
    name: STABLE_SYMBOL,
    symbol: STABLE_SYMBOL,
    decimals: STABLE_DECIMALS,
  },
  rpcUrls: {
    default: { http: [CHAIN_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: EXPLORER_URL },
  },
});

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

export function usdToStableWei(usd: string | number): bigint {
  return parseUnits(String(usd), STABLE_DECIMALS);
}

export async function getStableBalance(address: Address): Promise<bigint> {
  if (!address) return 0n;
  try {
    return (await publicClient.readContract({
      address: STABLE_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export const zerodevConfigured = Boolean(ZERODEV_PROJECT_ID);

// Kick off the boot-time contract presence check eagerly so misconfigured
// chains surface in the server logs before any request lands. The check is
// memoised inside chain-presence.ts; subsequent awaits return the cached
// result. Lazy-required to avoid a circular import.
if (typeof window === "undefined") {
  void (async () => {
    try {
      const mod = await import("./chain-presence");
      await mod.ensureContractsPresent();
    } catch (err) {
      console.error("[chain] contract presence check failed:", err);
    }
  })();
}

export { erc20Abi };
