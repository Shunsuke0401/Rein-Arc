/**
 * Manually deploy a Kernel for an agent by sending a no-op userOp via its
 * owner ECDSA key. Used when the implicit deploy-on-permission-install fails
 * silently and subsequent session-key payments revert with AA23.
 *
 * Usage: npx tsx scripts/deploy-kernel.ts <agentId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash, createDecipheriv } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createPublicClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";

function decrypt(ciphertext: string): string {
  const key = Buffer.from(process.env.APP_ENCRYPTION_KEY!, "hex");
  const [ivHex, tagHex, ctHex] = ciphertext.split(".");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

async function main() {
  const agentId = process.argv[2];
  if (!agentId) throw new Error("Usage: deploy-kernel.ts <agentId>");

  const adapter = new PrismaBetterSqlite3({ url: "./dev.db" });
  const db = new PrismaClient({ adapter });

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent?.ownerCiphertext) throw new Error("agent not found or missing owner");

  const ownerKey = decrypt(agent.ownerCiphertext) as Hex;
  const chainId = Number(process.env.ARC_CHAIN_ID!);
  const arcChain = defineChain({
    id: chainId,
    name: "Arc",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [process.env.ARC_RPC_URL!] } },
  });
  const arcPublic = createPublicClient({ chain: arcChain, transport: http(process.env.ARC_RPC_URL!) });
  const entryPoint = { address: entryPoint07Address, version: "0.7" as const };

  const signer = privateKeyToAccount(ownerKey);
  const ecdsaValidator = await signerToEcdsaValidator(arcPublic, {
    signer, entryPoint, kernelVersion: KERNEL_V3_1,
  });
  const account = await createKernelAccount(arcPublic, {
    plugins: { sudo: ecdsaValidator },
    entryPoint, kernelVersion: KERNEL_V3_1,
  });
  console.log("[deploy] account:", account.address);
  console.log("[deploy] stored:", agent.accountAddress);

  const paymaster = createZeroDevPaymasterClient({
    chain: arcChain, transport: http(process.env.ZERODEV_PAYMASTER_URL!),
  });
  const client = createKernelAccountClient({
    account, chain: arcChain,
    bundlerTransport: http(process.env.ZERODEV_BUNDLER_URL!),
    client: arcPublic,
    paymaster: {
      getPaymasterData: async (uo) => {
        const data = await paymaster.sponsorUserOperation({ userOperation: uo });
        console.log("[deploy] paymaster:", (data as any).paymaster ?? "(none)");
        return data;
      },
    },
  });

  const code = await arcPublic.getCode({ address: account.address as Address });
  if (code && code !== "0x") {
    console.log("[deploy] kernel already deployed, bytes:", (code.length - 2) / 2);
    await db.$disconnect();
    return;
  }

  console.log("[deploy] sending no-op userOp...");
  const hash = await client.sendUserOperation({
    callData: await account.encodeCalls([
      { to: account.address as Address, data: "0x" as Hex, value: 0n },
    ]),
  });
  console.log("[deploy] userOp hash:", hash);
  const receipt = await client.waitForUserOperationReceipt({
    hash, timeout: 180_000, pollingInterval: 2_000,
  });
  console.log("[deploy] tx hash:", receipt.receipt.transactionHash);
  console.log("[deploy] success:", receipt.success);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("[deploy] FAIL:", e?.message || e);
  process.exit(1);
});
