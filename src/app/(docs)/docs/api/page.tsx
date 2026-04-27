import Link from "next/link";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Callout,
  Code,
  EndpointBlock,
  H1,
  H2,
  Lead,
  P,
  Pre,
} from "@/components/docs-prose";

export const metadata = {
  title: "API Endpoints — Rein docs",
  description:
    "The four Bearer-authenticated Rein endpoints: payments, agent status, payees, activity.",
};

const BASE = "https://rein-arc-production.up.railway.app";

export default function ApiEndpointsPage() {
  return (
    <article>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        Documentation
      </div>
      <H1>API Endpoints</H1>
      <Lead>
        Four routes. Bearer-authenticated. Stable JSON responses. Everything
        the <Code>rein-sdk</Code> package does is a thin wrapper over these.
      </Lead>

      <div className="rounded-xl border bg-neutral-50 p-4 flex items-start gap-3 my-6">
        <KeyRound className="h-5 w-5 mt-0.5 text-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">Get your API key</div>
          <p className="text-sm text-neutral-600 mt-1">
            Every request needs a <Code>REIN_API_KEY</Code>. Create an agent
            in the dashboard — the key is shown once on creation.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/agents/new">Create agent</Link>
        </Button>
      </div>

      <H2 id="base-url">Base URL</H2>
      <Pre>{BASE}</Pre>

      <H2 id="auth">Authentication</H2>
      <P>
        All endpoints expect the Rein API key in the <Code>Authorization</Code>{" "}
        header as a Bearer token. The key format is{" "}
        <Code>rein_&lt;permissionId&gt;_&lt;sessionKeyHex&gt;</Code>.
      </P>
      <Pre language="bash">{`Authorization: Bearer $REIN_API_KEY`}</Pre>
      <Callout tone="warn" title="On secrets">
        Never commit <Code>REIN_API_KEY</Code>. Keep it in your runtime&rsquo;s
        secret manager. If a key leaks, create a new agent to rotate — we do
        not store the plaintext secret and cannot revoke-by-key today.
      </Callout>

      <EndpointBlock
        method="POST"
        path="/api/v1/payments"
        description={
          <>
            Send funds from the agent. <Code>to</Code> must be a raw{" "}
            <Code>0x…</Code> recipient address (labels are not accepted).
            Amount is in USD. The permission&rsquo;s caps and the recipient
            allow-list are enforced cryptographically — rejected attempts
            return <Code>PERMISSION_CAP_EXCEEDED</Code> or{" "}
            <Code>PAYEE_NOT_ALLOWED</Code>.
          </>
        }
        request={`{
  "to": "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518",
  "amountUsd": 50,
  "note": "weekly payout"
}`}
        response={`{
  "ok": true,
  "payment": {
    "id": "cmo…",
    "status": "confirmed",
    "amountUsd": 50,
    "to": "Stripe payouts",
    "createdAt": "2026-04-22T01:23:45.000Z"
  }
}`}
        errors={[
          { code: "INVALID_API_KEY", meaning: "Missing, malformed, or revoked key." },
          { code: "PERMISSION_CAP_EXCEEDED", meaning: "Amount exceeds the per-payment cap, or the request was rejected by the policy." },
          { code: "PAYEE_NOT_ALLOWED", meaning: "Recipient is not in this permission's payee allow-list." },
          { code: "PAYMENT_IN_FLIGHT", meaning: "A previous payment is still being processed. Wait ~30s and retry — do not retry immediately." },
        ]}
        example={`curl -X POST ${BASE}/api/v1/payments \\
  -H "authorization: Bearer $REIN_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"to":"0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518","amountUsd":50}'`}
      />

      <EndpointBlock
        method="GET"
        path="/api/v1/agent"
        description={
          <>
            Scoped view of the agent behind this permission. Useful for a
            &quot;is my budget tight?&quot; check before initiating a payment.
            <Code>remainingMonthlyUsd</Code> is the headroom until the monthly
            cap resets.
          </>
        }
        response={`{
  "agent": {
    "name": "support-refunds",
    "balanceUsd": 142.5,
    "spentThisMonthUsd": 420,
    "perPaymentLimitUsd": 50,
    "monthlyLimitUsd": 2000,
    "remainingMonthlyUsd": 1580,
    "status": "active"
  }
}`}
        example={`curl ${BASE}/api/v1/agent \\
  -H "authorization: Bearer $REIN_API_KEY"`}
      />

      <EndpointBlock
        method="GET"
        path="/api/v1/agent/payees"
        description={
          <>
            List the saved payees this permission can pay. Labels only —
            addresses are never returned. If the permission is open-mode
            (no payee allow-list pinned), returns an empty list with{" "}
            <Code>mode: &quot;open&quot;</Code>.
          </>
        }
        response={`{
  "payees": [
    { "id": "cmo…", "label": "Stripe payouts" },
    { "id": "cmo…", "label": "Acme Inc" }
  ],
  "mode": "closed"
}`}
        example={`curl ${BASE}/api/v1/agent/payees \\
  -H "authorization: Bearer $REIN_API_KEY"`}
      />

      <EndpointBlock
        method="GET"
        path="/api/v1/agent/activity?limit=10"
        description={
          <>
            Recent payments in and out of the agent. Normalized to labels +
            amounts; no transaction hashes or addresses.
            <Code>limit</Code> defaults to 10, max 100.
          </>
        }
        response={`{
  "activity": [
    {
      "timestamp": "2026-04-22T01:23:45.000Z",
      "direction": "out",
      "counterpartyLabel": "Stripe payouts",
      "amountUsd": 50,
      "status": "confirmed"
    }
  ]
}`}
        example={`curl "${BASE}/api/v1/agent/activity?limit=10" \\
  -H "authorization: Bearer $REIN_API_KEY"`}
      />

      <H2 id="sdk">SDK (Node / TypeScript)</H2>
      <P>
        The <Code>rein-sdk</Code> npm package is a one-file TypeScript client
        over these endpoints. Install, set <Code>REIN_API_KEY</Code>, call.
      </P>
      <Pre language="bash">{`npm install rein-sdk dotenv`}</Pre>
      <Pre language="ts">{`import "dotenv/config";
import { Rein } from "rein-sdk";

const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });

await rein.payments.create({
  to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518",
  amountUsd: 50,
});
await rein.agent.status();
await rein.agent.payees();
await rein.agent.activity({ limit: 10 });`}</Pre>

      <H2 id="python">From Python</H2>
      <P>
        There is no official Python SDK yet — the API is plain HTTPS, so any
        HTTP client works. Below uses <Code>httpx</Code> plus{" "}
        <Code>python-dotenv</Code> to load the key from a{" "}
        <Code>.env</Code> file.
      </P>
      <Pre language="bash">{`pip install httpx python-dotenv`}</Pre>
      <Pre language="python">{`import os
import httpx
from dotenv import load_dotenv

load_dotenv()  # reads REIN_API_KEY from .env in the current dir

r = httpx.post(
    "${BASE}/api/v1/payments",
    headers={"authorization": f"Bearer {os.environ['REIN_API_KEY']}"},
    json={
        "to": "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518",
        "amountUsd": 5,
    },
    # The first payment for a new agent provisions the agent and can take
    # 20-40s. Stay above the server's 180s receipt wait.
    timeout=200,
)
print(r.status_code, r.json())
r.raise_for_status()`}</Pre>
      <Callout tone="warn" title="On the first call's latency">
        The very first <Code>/api/v1/payments</Code> call for a new agent
        provisions the agent and the permission as part of the payment —
        expect ~20-40s end-to-end. Subsequent calls return in a few seconds.
        If your client cuts off too early (<Code>httpx</Code> defaults to
        5s; <Code>requests</Code> has no default timeout), you&rsquo;ll see
        a transport error even though the payment lands. Set the client
        timeout to at least 200s.
      </Callout>
    </article>
  );
}
