import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Callout,
  Code,
  H1,
  H2,
  Lead,
  LI,
  P,
  Pre,
  UL,
} from "@/components/docs-prose";

export const metadata = {
  title: "Get Started — Rein docs",
  description:
    "Give your AI agent a bounded way to spend. Create an agent, copy the API key, send your first payment in under a minute.",
};

export default function GetStartedPage() {
  return (
    <article>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        Documentation
      </div>
      <H1>Get Started</H1>
      <Lead>
        Rein gives AI agents a programmable balance with hard spending
        caps. Create an agent in the dashboard, copy one API key, and your
        agent is ready to pay — with the rules it cannot bypass.
      </Lead>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button asChild>
          <Link href="/dashboard/agents/new">
            Create your first agent <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href="https://www.npmjs.com/package/rein-sdk"
            target="_blank"
            rel="noreferrer"
          >
            View on npm
          </a>
        </Button>
      </div>

      <H2 id="quickstart">Quickstart</H2>
      <P>Four steps, one minute. You&rsquo;ll have a working agent that can spend.</P>

      <H2 id="step-1">1. Create an agent</H2>
      <P>
        Go to the <Link href="/dashboard/agents/new" className="underline hover:no-underline">new-agent wizard</Link>.
        Pick a name, set a per-payment cap and a monthly cap, and add the
        recipients the agent is allowed to pay. You can skip the payee step to
        leave it unrestricted.
      </P>

      <H2 id="step-2">2. Copy your API key</H2>
      <P>
        The moment an agent is created, the dashboard shows a one-shot
        credentials modal. Click <b>Copy as .env</b> — your key looks like:
      </P>
      <Pre>{`REIN_BASE=https://rein.up.railway.app
REIN_API_KEY=rein_<permissionId>_<sessionKeyHex>`}</Pre>
      <Callout tone="warn" title="Save it now">
        The secret half of the key is never shown again. If you lose it, create
        a new agent — we can&rsquo;t retrieve it.
      </Callout>

      <H2 id="step-3">3. Install the SDK</H2>
      <Pre language="bash">{`npm install rein-sdk`}</Pre>

      <H2 id="step-4">4. Send your first payment</H2>
      <P>
        Either language works. The SDK and cURL both hit{" "}
        <Code>POST /api/v1/payments</Code> with your key as a{" "}
        <Code>Bearer</Code> token.
      </P>

      <Pre language="ts">{`import { Rein } from "rein-sdk";

const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });

const payment = await rein.payments.create({
  to: "0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518", // 0x address
  amountUsd: 5,
});

console.log(payment.status); // "confirmed"`}</Pre>

      <Pre language="bash">{`curl -X POST https://rein.up.railway.app/api/v1/payments \\
  -H "authorization: Bearer $REIN_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"to":"0x5D262Ad5F60189Bb21Eb6cF6BCA7Db04F2C01518","amountUsd":5}'`}</Pre>

      <Callout tone="info" title="Addresses only">
        <Code>to</Code> must be a raw <Code>0x…</Code> address. Saved payees
        still matter — they pin the allow-list at permission creation —
        but the SDK no longer does label resolution. Copy the address
        from the Payees tab.
      </Callout>

      <H2 id="what-you-get">What happens on a payment</H2>
      <P>
        When you call <Code>payments.create</Code>, the Rein server loads
        the permission and submits the request. The cap and the payee
        allow-list are enforced cryptographically <i>before</i> any money
        moves. An overspend attempt is rejected and returns a typed error:
      </P>
      <UL>
        <LI>
          <Code>PERMISSION_CAP_EXCEEDED</Code> — amount over the per-payment cap, or the request was rejected by the policy.
        </LI>
        <LI>
          <Code>PAYEE_NOT_ALLOWED</Code> — recipient not on the allow-list.
        </LI>
        <LI>
          <Code>PAYMENT_IN_FLIGHT</Code> — a previous payment is still being processed; wait ~30s before retrying.
        </LI>
        <LI>
          <Code>INVALID_API_KEY</Code> — missing, malformed, or revoked key.
        </LI>
      </UL>

      <H2 id="next">Next</H2>
      <UL>
        <LI>
          <Link href="/docs/api" className="underline hover:no-underline">
            API Endpoints
          </Link>{" "}
          — request/response shapes for every route.
        </LI>
        <LI>
          <Link href="/docs/create-agent" className="underline hover:no-underline">
            Create Agent
          </Link>{" "}
          — programmatic agent creation, coming soon.
        </LI>
      </UL>
    </article>
  );
}
