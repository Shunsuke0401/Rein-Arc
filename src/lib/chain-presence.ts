import "server-only";

import {
  CALL_POLICY_CONTRACT_V0_0_5,
  RATE_LIMIT_POLICY_CONTRACT,
  RATE_LIMIT_POLICY_WITH_RESET_CONTRACT,
} from "@zerodev/permissions";
import { KernelVersionToAddressesMap } from "@zerodev/sdk/constants";
import type { Address } from "viem";

import {
  CHAIN_NAME,
  STABLE_ADDRESS,
  STABLE_SYMBOL,
  publicClient,
} from "./chain";

// Kernel v3.1 — must match KERNEL_VERSION in kernel.ts.
const KERNEL_IMPL_ADDRESS = KernelVersionToAddressesMap["0.3.1"]
  .accountImplementationAddress as Address;
// @zerodev/ecdsa-validator/_esm/constants.js — ">=0.3.1" entry.
const ECDSA_VALIDATOR_ADDRESS =
  "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57" as Address;

export type ContractPresence = {
  stable: boolean;
  callPolicy: boolean;
  rateLimit: boolean;
  rateLimitWithReset: boolean;
  kernelImpl: boolean;
  ecdsaValidator: boolean;
};

async function isDeployed(addr: Address): Promise<boolean> {
  try {
    const code = await publicClient.getCode({ address: addr });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}

export async function checkContractPresence(): Promise<ContractPresence> {
  const [
    stable,
    callPolicy,
    rateLimit,
    rateLimitWithReset,
    kernelImpl,
    ecdsaValidator,
  ] = await Promise.all([
    isDeployed(STABLE_ADDRESS),
    isDeployed(CALL_POLICY_CONTRACT_V0_0_5 as Address),
    isDeployed(RATE_LIMIT_POLICY_CONTRACT as Address),
    isDeployed(RATE_LIMIT_POLICY_WITH_RESET_CONTRACT as Address),
    isDeployed(KERNEL_IMPL_ADDRESS),
    isDeployed(ECDSA_VALIDATOR_ADDRESS),
  ]);
  return {
    stable,
    callPolicy,
    rateLimit,
    rateLimitWithReset,
    kernelImpl,
    ecdsaValidator,
  };
}

let cached: Promise<ContractPresence> | null = null;

// Run once per process. Refuse to start if the things we need aren't there;
// log a warning when an optional contract is missing so behaviour can fall
// back gracefully (see kernel.ts:buildPoliciesForScope rate-limit selection).
export function ensureContractsPresent(): Promise<ContractPresence> {
  if (!cached) {
    cached = (async () => {
      const presence = await checkContractPresence();
      const missing: string[] = [];
      if (!presence.stable) missing.push(`${STABLE_SYMBOL} (${STABLE_ADDRESS})`);
      if (!presence.callPolicy) missing.push("CallPolicy v0.0.5");
      if (!presence.kernelImpl) missing.push("Kernel v3.1 implementation");
      if (!presence.ecdsaValidator) missing.push("ECDSA validator");
      if (!presence.rateLimit && !presence.rateLimitWithReset) {
        missing.push("any rate-limit policy");
      }

      if (missing.length > 0) {
        const detail = missing.join(", ");
        throw new Error(
          `[chain-presence] ${CHAIN_NAME} is missing required contracts: ${detail}. ` +
            `Refusing to start. Verify env values for this chain.`,
        );
      }

      console.info(
        `[chain-presence] ${CHAIN_NAME} ready. ` +
          `stable=${STABLE_SYMBOL} ` +
          `callPolicy=ok ` +
          `rateLimit=${presence.rateLimit ? "ok" : "MISSING"} ` +
          `rateLimitWithReset=${
            presence.rateLimitWithReset ? "ok" : "MISSING (will fall back to lifetime cap)"
          } ` +
          `kernelImpl=ok ecdsaValidator=ok`,
      );
      return presence;
    })().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export async function rateLimitWithResetAvailable(): Promise<boolean> {
  const p = await ensureContractsPresent();
  return p.rateLimitWithReset;
}
