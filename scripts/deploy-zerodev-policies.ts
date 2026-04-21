/**
 * Deploy ZeroDev's @zerodev/permissions policy contracts to Arc testnet via
 * Arachnid's CREATE2 deployer. The payloads are `salt(32 bytes) ‖ creationCode`
 * harvested from each contract's original Ethereum-mainnet deployment tx, so
 * CREATE2 places them at the exact addresses the SDK hardcodes.
 *
 * Usage:  ARC_DEPLOYER_KEY=0x... npx tsx scripts/deploy-zerodev-policies.ts
 * Requires: the funder EOA must hold native USDC on Arc (gas token).
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getContractAddress,
  http,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ARACHNID = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as const;
const CALLDATA_DIR = "/tmp/zerodev-calldata";

const policies: Array<{ name: string; expected: Address; file: string }> = [
  { name: "SUDO_POLICY",        expected: "0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7", file: "SUDO_POLICY.hex" },
  { name: "TIMESTAMP_POLICY",   expected: "0xB9f8f524bE6EcD8C945b1b87f9ae5C192FdCE20F", file: "TIMESTAMP_POLICY.hex" },
  { name: "SIGNATURE_POLICY",   expected: "0xF6A936c88D97E6fad13b98d2FD731Ff17eeD591d", file: "SIGNATURE_POLICY.hex" },
  { name: "RATE_LIMIT_POLICY",  expected: "0xf63d4139B25c836334edD76641356c6b74C86873", file: "RATE_LIMIT_POLICY.hex" },
  { name: "GAS_POLICY",         expected: "0xaeFC5AbC67FfD258abD0A3E54f65E70326F84b23", file: "GAS_POLICY.hex" },
  { name: "CALL_POLICY_V0_0_5", expected: "0x85770b902D1e503D5f5141d9eaC16d0d08eEaDd2", file: "CALL_POLICY_V0_0_5.hex" },
];

function predictCreate2(deployer: Address, salt: Hex, initCode: Hex): Address {
  return getContractAddress({ bytecode: initCode, from: deployer, opcode: "CREATE2", salt });
}

async function main() {
  const key = process.env.ARC_DEPLOYER_KEY as Hex | undefined;
  if (!key) throw new Error("ARC_DEPLOYER_KEY missing (0x…64hex EOA private key)");

  const rpc = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
  const chainId = Number(process.env.ARC_CHAIN_ID ?? 5042002);
  const arc = defineChain({
    id: chainId,
    name: "Arc",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const pub = createPublicClient({ chain: arc, transport: http(rpc) });
  const acct = privateKeyToAccount(key);
  const wallet = createWalletClient({ chain: arc, transport: http(rpc), account: acct });

  console.log(`[deploy] funder: ${acct.address}`);
  const bal = await pub.getBalance({ address: acct.address });
  console.log(`[deploy] balance: ${bal} (native)`);

  // 1. Local verification pass — predict every address before spending gas.
  for (const p of policies) {
    const raw = readFileSync(`${CALLDATA_DIR}/${p.file}`, "utf8").trim() as Hex;
    if (raw.length < 2 + 64) throw new Error(`${p.name}: payload too short`);
    const salt = `0x${raw.slice(2, 66)}` as Hex;
    const initCode = `0x${raw.slice(66)}` as Hex;
    const predicted = predictCreate2(ARACHNID, salt, initCode);
    const match = predicted.toLowerCase() === p.expected.toLowerCase();
    console.log(`[verify] ${p.name.padEnd(24)} predicted=${predicted} ${match ? "✓" : "✗ MISMATCH"}`);
    if (!match) throw new Error(`${p.name} CREATE2 mismatch — abort`);
  }

  // 2. Deploy pass — skip if code already exists at the expected address.
  for (const p of policies) {
    const existing = await pub.getCode({ address: p.expected });
    if (existing && existing !== "0x") {
      console.log(`[skip] ${p.name} already deployed (${(existing.length - 2) / 2} bytes)`);
      continue;
    }
    const raw = readFileSync(`${CALLDATA_DIR}/${p.file}`, "utf8").trim() as Hex;
    console.log(`[send] ${p.name} (${(raw.length - 2) / 2} bytes)...`);
    const hash = await wallet.sendTransaction({
      to: ARACHNID,
      data: raw,
      gas: 6_000_000n,
    });
    const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    const code = await pub.getCode({ address: p.expected });
    const bytes = code ? (code.length - 2) / 2 : 0;
    console.log(`[sent] ${p.name} tx=${hash} status=${rcpt.status} code=${bytes}b`);
    if (bytes === 0) throw new Error(`${p.name} deployment tx confirmed but no code at ${p.expected}`);
  }

  console.log("[deploy] all policies present on Arc ✅");
}

main().catch((e) => {
  console.error("[deploy] FAIL:", e?.message || e);
  process.exit(1);
});
