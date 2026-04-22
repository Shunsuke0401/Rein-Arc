import Link from "next/link";
import { Sparkles } from "lucide-react";

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
  title: "Create Agent (coming soon) — Rein docs",
  description:
    "Programmatic agent creation via the rein-sdk is on the roadmap. For now, create agents in the dashboard.",
};

export default function CreateAgentPage() {
  return (
    <article>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
        Documentation
      </div>
      <H1>Create Agent</H1>

      <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 mb-4">
        <Sparkles className="h-3 w-3" /> Coming soon
      </div>

      <Lead>
        Programmatic agent creation is next on the roadmap. The server-side
        piece already exists — deploying a Kernel, installing a session key,
        returning one-shot credentials — and the SDK&rsquo;s shape will mirror
        it. Until the route ships, create agents in the dashboard.
      </Lead>

      <div className="mb-6">
        <Button asChild>
          <Link href="/dashboard/agents/new">
            Create in the dashboard
          </Link>
        </Button>
      </div>

      <H2 id="preview">Planned SDK interface</H2>
      <P>
        This is the target signature for <Code>rein.agents.create</Code>. It
        will match the fields collected by the dashboard wizard and return
        the same one-shot API key the UI does today.
      </P>

      <Pre language="ts">{`// Coming soon
import { Rein } from "rein-sdk";

const rein = new Rein({ apiKey: process.env.REIN_ADMIN_KEY! });

const { agent, apiKey } = await rein.agents.create({
  name: "support-refunds",
  perPaymentLimitUsd: 50,
  monthlyLimitUsd: 2000,
  payees: [
    { label: "Stripe payouts", address: "0x…" },
    { label: "Acme Inc",       address: "0x…" },
  ],
});

// Save apiKey immediately — it is only returned once.
console.log(apiKey); // "rein_…"`}</Pre>

      <Callout tone="soon" title="Why it&rsquo;s not live yet">
        Admin-scoped API keys need their own auth surface separate from the
        agent-scoped <Code>REIN_API_KEY</Code>. We&rsquo;re sizing the
        &quot;admin key rotation + grant scope&quot; UX before shipping a
        write endpoint that can create new spenders.
      </Callout>

      <H2 id="workarounds">Until it ships</H2>
      <UL>
        <LI>
          Create the agent in the dashboard. The wizard covers name, caps,
          payees, and hands you a <Code>REIN_API_KEY</Code>.
        </LI>
        <LI>
          Automate payments with <Code>rein-sdk</Code> — see{" "}
          <Link href="/docs/api" className="underline hover:no-underline">
            API Endpoints
          </Link>
          .
        </LI>
        <LI>
          Want early access? Open an issue on{" "}
          <a
            href="https://github.com/Shunsuke0401/Rein-Arc/issues"
            className="underline hover:no-underline"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </LI>
      </UL>
    </article>
  );
}
