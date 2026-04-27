import "server-only";

import {
  addressToEmptyAccount,
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  uninstallPlugin,
} from "@zerodev/sdk";
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from "@zerodev/permissions";
import {
  CallPolicyVersion,
  toCallPolicy,
} from "@zerodev/permissions/policies";
import { toRateLimitPolicy } from "@zerodev/permissions/policies";
import { ParamCondition } from "@zerodev/permissions/policies";
import { toECDSASigner } from "@zerodev/permissions/signers";
import {
  encodeFunctionData,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  RATE_LIMIT_VARIANT,
  STABLE_ADDRESS,
  STABLE_DECIMALS,
  ZERODEV_BUNDLER_URL,
  ZERODEV_PAYMASTER_URL,
  chain,
  publicClient,
  erc20Abi,
} from "./chain";
import {
  RATE_LIMIT_POLICY_CONTRACT,
  RATE_LIMIT_POLICY_WITH_RESET_CONTRACT,
} from "@zerodev/permissions";
import { rateLimitWithResetAvailable } from "./chain-presence";

// ZeroDev Kernel v3.1 on EntryPoint v0.7. Every agent is one Kernel; every
// permission is one session-key plugin installed on that Kernel.
//
// Architecture note (hackathon shortcut):
// The Kernel's sudo validator is an ECDSA signer whose key we hold
// server-side, encrypted at rest via AES-256-GCM (APP_ENCRYPTION_KEY). The
// customer's passkey gates the session (via /api/auth/login) rather than
// signing individual owner operations. In a production build the sudo
// validator would be a WebAuthn passkey with user verification per signature;
// the session-key install / revoke paths would become browser-driven.

const ENTRY_POINT = {
  address: entryPoint07Address,
  version: "0.7",
} as const;

const KERNEL_VERSION = KERNEL_V3_1;

export type SessionKeyScope = {
  perTxCapUsd: number;
  monthlyCapUsd: number;
  // 30-day rolling window, approximated as a single rate-limit interval.
  windowDays?: number;
  // Recipient allow-list. If non-empty, the CallPolicy pins the `to` arg of
  // `transfer(to, amount)` via ParamCondition.ONE_OF, so the Kernel's
  // permission validator rejects any payment to an address not in this list —
  // enforced on chain, not by the Rein server.
  allowedPayees?: Address[];
};

function bundlerTransport() {
  if (!ZERODEV_BUNDLER_URL) {
    throw new Error("ZERODEV_BUNDLER_URL is not configured");
  }
  return http(ZERODEV_BUNDLER_URL);
}

function paymasterClient() {
  if (!ZERODEV_PAYMASTER_URL) {
    throw new Error("ZERODEV_PAYMASTER_URL is not configured");
  }
  return createZeroDevPaymasterClient({
    chain: chain,
    transport: http(ZERODEV_PAYMASTER_URL),
  });
}

// -----------------------------------------------------------------------------
// Agent owner + Kernel account
// -----------------------------------------------------------------------------

export function generateAgentOwnerPrivateKey(): Hex {
  return generatePrivateKey();
}

export async function buildKernelAccountForOwner(ownerPrivateKey: Hex) {
  const signer = privateKeyToAccount(ownerPrivateKey);
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });
  return { account, ecdsaValidator };
}

export async function computeKernelAddress(
  ownerPrivateKey: Hex,
): Promise<Address> {
  const { account } = await buildKernelAccountForOwner(ownerPrivateKey);
  return account.address;
}

function kernelClientForAccount<A extends Awaited<ReturnType<typeof createKernelAccount>>>(
  account: A,
) {
  const paymaster = paymasterClient();
  return createKernelAccountClient({
    account,
    chain: chain,
    bundlerTransport: bundlerTransport(),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymaster.sponsorUserOperation({ userOperation }),
    },
  });
}

// -----------------------------------------------------------------------------
// Permission install / revoke
// -----------------------------------------------------------------------------

async function resolveUseWithReset(): Promise<boolean> {
  if (RATE_LIMIT_VARIANT === "lifetime") return false;
  const available = await rateLimitWithResetAvailable();
  if (RATE_LIMIT_VARIANT === "with-reset") {
    if (!available) {
      throw new Error(
        "RATE_LIMIT_VARIANT=with-reset but RATE_LIMIT_POLICY_WITH_RESET_CONTRACT is not deployed on this chain",
      );
    }
    return true;
  }
  return available;
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

async function buildPoliciesForScope(scope: SessionKeyScope) {
  const perTxCapWei = parseUnits(
    String(scope.perTxCapUsd),
    STABLE_DECIMALS,
  );
  const recipientArg =
    scope.allowedPayees && scope.allowedPayees.length > 0
      ? {
          condition: ParamCondition.ONE_OF as const,
          value: [...scope.allowedPayees] as `0x${string}`[],
        }
      : null;
  const amountArg = {
    condition: ParamCondition.LESS_THAN as const,
    value: perTxCapWei + 1n,
  };
  const callPolicy = toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_5,
    permissions: [
      {
        target: STABLE_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        valueLimit: 0n,
        args: [recipientArg, amountArg],
      },
    ],
  });
  const maxCalls = Math.max(
    1,
    Math.ceil(scope.monthlyCapUsd / Math.max(1, scope.perTxCapUsd)),
  );
  // Two rate-limit policy contracts exist:
  //   - RATE_LIMIT_POLICY_CONTRACT: `interval > 0` = cooldown between
  //     consecutive calls (NOT a window), so we use `interval: 0` to get a
  //     pure lifetime count cap. Rotate the permission to refresh it.
  //   - RATE_LIMIT_POLICY_WITH_RESET_CONTRACT: rolling-window variant; the
  //     proper "monthly cap" shape. Used when the env says so AND the
  //     contract is actually deployed on the configured chain.
  // The selection is settled at install time and baked into the on-chain
  // validator — existing permissions are unaffected by config changes.
  const useWithReset = await resolveUseWithReset();
  const rateLimitPolicy = useWithReset
    ? toRateLimitPolicy({
        policyAddress: RATE_LIMIT_POLICY_WITH_RESET_CONTRACT as Address,
        interval: THIRTY_DAYS_SECONDS,
        count: maxCalls,
      })
    : toRateLimitPolicy({
        policyAddress: RATE_LIMIT_POLICY_CONTRACT as Address,
        interval: 0,
        count: maxCalls,
      });
  return [callPolicy, rateLimitPolicy];
}

export type InstallSessionKeyResult = {
  sessionKeyId: string;
  sessionKeyAddress: Address;
  sessionKeyPrivateKey: Hex;
  serializedAccount: string;
  installTxHash?: string;
};

export async function installSessionKey(params: {
  ownerPrivateKey: Hex;
  scope: SessionKeyScope;
}): Promise<InstallSessionKeyResult> {
  const { ownerPrivateKey, scope } = params;
  const ownerSigner = privateKeyToAccount(ownerPrivateKey);
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: ownerSigner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const sessionKeyPrivateKey = generatePrivateKey();
  const sessionKeySigner = privateKeyToAccount(sessionKeyPrivateKey);
  const modularSigner = await toECDSASigner({ signer: sessionKeySigner });

  const policies = await buildPoliciesForScope(scope);
  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: modularSigner,
    policies,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: sudoValidator,
      regular: permissionValidator,
    },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  // Intentionally OMIT the private key from the serialized blob. We only
  // persist the permission/plugin structure; the raw session key is returned
  // once to the customer as the API secret and must be presented on every
  // payment. Without it, a DB-only compromise can't sign anything.
  const serialized = await serializePermissionAccount(account);

  // Force Kernel deployment + permission install with a no-op userOp from the
  // owner-sudo path. The paymaster pays for this — the agent has no gas token.
  let installTxHash: string | undefined;
  try {
    const client = kernelClientForAccount(account);
    const hash = await client.sendUserOperation({
      callData: await account.encodeCalls([
        {
          to: account.address,
          data: "0x",
          value: 0n,
        },
      ]),
    });
    const receipt = await client.waitForUserOperationReceipt({ hash });
    installTxHash = receipt.receipt.transactionHash;
  } catch (err) {
    // In hackathon dev without a funded paymaster this will throw; we still
    // return the serialized permission so the UI flow completes and the API
    // credentials are shown. The install retries implicitly on the next
    // session-key userOp (ZeroDev bundlers deploy + install on first use).
    console.warn("[kernel] session-key install userOp failed:", err);
  }

  return {
    sessionKeyId: permissionValidator.getIdentifier(),
    sessionKeyAddress: sessionKeySigner.address,
    sessionKeyPrivateKey,
    serializedAccount: serialized,
    installTxHash,
  };
}

export async function revokeSessionKey(params: {
  ownerPrivateKey: Hex;
  sessionKeyAddress: Address;
  scope: SessionKeyScope;
}): Promise<string | undefined> {
  const { ownerPrivateKey, sessionKeyAddress, scope } = params;
  const ownerSigner = privateKeyToAccount(ownerPrivateKey);
  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: ownerSigner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  // Rebuild the permission validator deterministically from its public
  // metadata (stored policy params + the session-key address) so uninstall
  // can produce the same validatorId + enableData as install did.
  const emptySigner = addressToEmptyAccount(sessionKeyAddress);
  const modularSigner = await toECDSASigner({ signer: emptySigner });
  const permissionValidator = await toPermissionValidator(publicClient, {
    signer: modularSigner,
    policies: await buildPoliciesForScope(scope),
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const ownerAccount = await createKernelAccount(publicClient, {
    plugins: { sudo: sudoValidator },
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  const client = kernelClientForAccount(ownerAccount);
  try {
    const hash = await uninstallPlugin(client, { plugin: permissionValidator });
    const receipt = await client.waitForUserOperationReceipt({ hash });
    return receipt.receipt.transactionHash;
  } catch (err) {
    console.warn("[kernel] session-key uninstall failed:", err);
    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Payment runtime (called by /api/payments)
// -----------------------------------------------------------------------------

export async function sendUsdcFromSessionKey(params: {
  serializedSessionKeyAccount: string;
  sessionKeyPrivateKey: Hex;
  to: Address;
  amountUsd: number | string;
}): Promise<{ userOpHash: Hex; txHash: Hex }> {
  const { serializedSessionKeyAccount, sessionKeyPrivateKey, to, amountUsd } =
    params;
  const sessionKeySigner = privateKeyToAccount(sessionKeyPrivateKey);
  const modularSigner = await toECDSASigner({ signer: sessionKeySigner });
  const account = await deserializePermissionAccount(
    publicClient,
    ENTRY_POINT,
    KERNEL_VERSION,
    serializedSessionKeyAccount,
    modularSigner,
  );
  const client = kernelClientForAccount(account);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(String(amountUsd), STABLE_DECIMALS)],
  });
  const hash = await client.sendUserOperation({
    callData: await account.encodeCalls([
      { to: STABLE_ADDRESS, data, value: 0n },
    ]),
  });
  // Arc's bundler can take >60s to confirm on a cold path; viem's default
  // timeout is too short. Poll a bit longer before giving up.
  const receipt = await client.waitForUserOperationReceipt({
    hash,
    timeout: 180_000,
    pollingInterval: 2_000,
  });
  return { userOpHash: hash, txHash: receipt.receipt.transactionHash };
}

export async function sweepAgentUsdc(params: {
  ownerPrivateKey: Hex;
  to: Address;
}): Promise<{ txHash?: Hex; amount: bigint }> {
  const { ownerPrivateKey, to } = params;
  const { account } = await buildKernelAccountForOwner(ownerPrivateKey);
  const balance = (await publicClient.readContract({
    address: STABLE_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (balance === 0n) return { amount: 0n };
  const client = kernelClientForAccount(account);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, balance],
  });
  try {
    const hash = await client.sendUserOperation({
      callData: await account.encodeCalls([
        { to: STABLE_ADDRESS, data, value: 0n },
      ]),
    });
    const receipt = await client.waitForUserOperationReceipt({ hash });
    return { txHash: receipt.receipt.transactionHash, amount: balance };
  } catch (err) {
    console.warn("[kernel] sweep failed:", err);
    return { amount: balance };
  }
}
