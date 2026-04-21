// Arc chain configuration. Arc is Circle's L1; USDC is the native gas token
// and sub-second finality means we treat txs as final after 1 confirmation.
// Testnet-only for now — all URLs below point at Arc testnet.
//
// Source: docs.arc.network/references/connect-to-arc.md.

import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  parseUnits,
  type Address,
} from "viem";

export const ARC_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? process.env.ARC_CHAIN_ID ?? 5042002,
);

const ARC_RPC_URL =
  process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  // USDC is the native gas token on Arc.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
});

export const arcPublic = createPublicClient({
  chain: arcChain,
  transport: http(),
});

// USDC ERC-20 contract address on Arc. On Arc the native token is USDC, but
// balance reads and transfers still go through the ERC-20 surface for
// interoperability. Fill from docs.arc.network/references/contract-addresses.
export const USDC_ADDRESS = (process.env.USDC_CONTRACT_ARC ??
  "0x0000000000000000000000000000000000000000") as Address;

export const USDC_DECIMALS = 6;

export function usdToUsdcWei(usd: string | number): bigint {
  return parseUnits(String(usd), USDC_DECIMALS);
}

export async function getUsdcBalance(address: Address): Promise<bigint> {
  if (
    USDC_ADDRESS === "0x0000000000000000000000000000000000000000" ||
    !address
  )
    return 0n;
  try {
    return (await arcPublic.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
  } catch {
    return 0n;
  }
}

export const ZERODEV_PROJECT_ID = process.env.ZERODEV_PROJECT_ID ?? "";
export const ZERODEV_BUNDLER_URL = process.env.ZERODEV_BUNDLER_URL ?? "";
export const ZERODEV_PAYMASTER_URL = process.env.ZERODEV_PAYMASTER_URL ?? "";

export const zerodevConfigured = Boolean(
  ZERODEV_PROJECT_ID && ZERODEV_BUNDLER_URL && ZERODEV_PAYMASTER_URL,
);

export { erc20Abi };
