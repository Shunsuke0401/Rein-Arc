import "server-only";

import {
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { USDC_ADDRESS, USDC_DECIMALS, arcChain, arcPublic, erc20Abi } from "./arc";

// Mock fiat on-ramp: a Rein-operated EOA, pre-funded with testnet USDC via
// https://faucet.circle.com, that simulates an ACH / card top-up by sending
// USDC to the target agent's Kernel. In production this becomes a real
// Stripe / Circle fiat-on-ramp call and the funder is unnecessary.

function funder(): ReturnType<typeof privateKeyToAccount> {
  const pk = process.env.REIN_ONRAMP_FUNDER_PRIVATE_KEY;
  if (!pk) throw new Error("REIN_ONRAMP_FUNDER_PRIVATE_KEY is not set");
  return privateKeyToAccount(pk as Hex);
}

export function onrampConfigured(): boolean {
  return Boolean(process.env.REIN_ONRAMP_FUNDER_PRIVATE_KEY);
}

export async function sendMockFiatTopup(params: {
  to: Address;
  amountUsd: number | string;
}): Promise<{ txHash: Hex }> {
  const { to, amountUsd } = params;
  const account = funder();
  const wallet = createWalletClient({
    account,
    chain: arcChain,
    transport: http(),
  });
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(String(amountUsd), USDC_DECIMALS)],
  });
  const hash = await wallet.sendTransaction({
    to: USDC_ADDRESS,
    data,
    value: 0n,
  });
  await arcPublic.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}
