/**
 * Example: an AI agent that spends through a Rein Permission.
 *
 * The agent has ONE tool: `pay`. Behind the tool is a scoped Rein API key
 * (apiKeyId + apiSecret) that can only send USDC to approved payees, up to
 * the per-payment cap, up to the monthly cap. If the model tries to over-send,
 * the on-chain permission validator rejects the userOp.
 *
 * Run:
 *   OPENAI_API_KEY=sk-... \
 *   REIN_BASE=http://localhost:3457 \
 *   REIN_API_KEY_ID=... \
 *   REIN_API_SECRET=0x... \
 *   npx tsx examples/ai-agent-pay.ts "Refund support ticket #4212 — $5 to Stripe payouts."
 */
import OpenAI from "openai";

const BASE = process.env.REIN_BASE ?? "http://localhost:3457";
const API_KEY_ID = must("REIN_API_KEY_ID");
const API_SECRET = must("REIN_API_SECRET");

const payees = [
  { id: process.env.REIN_PAYEE_ID ?? "", label: "Stripe payouts" },
];

const tools = [
  {
    type: "function" as const,
    function: {
      name: "pay",
      description:
        "Send USDC to a saved payee. The caller's Permission enforces a per-payment cap and a monthly cap on-chain; attempts beyond those will revert.",
      parameters: {
        type: "object",
        properties: {
          payeeId: { type: "string", description: "ID of a saved payee." },
          amountUsd: { type: "number", description: "Amount in USD." },
          memo: { type: "string", description: "Internal note (not sent on-chain)." },
        },
        required: ["payeeId", "amountUsd"],
      },
    },
  },
];

async function pay(payeeId: string, amountUsd: number) {
  const r = await fetch(`${BASE}/api/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKeyId: API_KEY_ID, apiSecret: API_SECRET, payeeId, amountUsd }),
  });
  return { status: r.status, body: await r.json() };
}

async function main() {
  const prompt = process.argv.slice(2).join(" ") || "Refund customer X $5 for a shipping delay.";
  const client = new OpenAI();
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    tools,
    messages: [
      {
        role: "system",
        content: `You are a support ops agent. When asked to refund, pay, or reimburse, call the pay tool. Payees available: ${JSON.stringify(payees)}.`,
      },
      { role: "user", content: prompt },
    ],
  });
  const call = resp.choices[0].message.tool_calls?.[0];
  if (!call || call.function.name !== "pay") {
    console.log("model did not call pay:", resp.choices[0].message.content);
    return;
  }
  const args = JSON.parse(call.function.arguments) as { payeeId: string; amountUsd: number };
  console.log("[agent]", prompt);
  console.log("[tool call] pay", args);
  const result = await pay(args.payeeId, args.amountUsd);
  console.log("[rein]", result);
}

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

main().catch((e) => { console.error(e); process.exit(1); });
