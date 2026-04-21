import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Database,
  Megaphone,
  Receipt,
  ShoppingCart,
} from "lucide-react";

import { AgentChatDemo } from "@/components/agent-chat-demo";
import { Hero } from "@/components/hero";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

// Landing page lives at `/`. CTAs resolve to the in-app sign-in at `/login`.
// Signed-in visitors are redirected to their dashboard.
//
// Marketing copy exception: per CLAUDE.md the strict product-vocabulary ban
// does NOT apply to this surface — generic crypto nouns like "programmable
// wallet" are allowed here. Product-internal jargon (Tempo, USDC, Turnkey,
// Kernel, etc.) must still not appear.

const APP_URL = "/login";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-white">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
        <Link href="/" className="font-semibold text-xl tracking-tight">
          rein
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm text-neutral-600">
          <a href="#how" className="hidden sm:inline hover:text-foreground">
            How it works
          </a>
          <a href="#use-cases" className="hidden sm:inline hover:text-foreground">
            Use cases
          </a>
          <a
            href={APP_URL}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Sign in
          </a>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6">
        <Hero appUrl={APP_URL} />
      </section>

      <section
        id="how"
        className="max-w-6xl mx-auto px-6 py-14 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 md:items-center"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            How it works
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            Give agents a programmable wallet they can use to hold, receive,
            and send funds.
          </h2>
          <p className="mt-5 text-neutral-600 leading-relaxed">
            Each agent gets its own account with a balance and a set of rules
            you define. The runtime sends plain-English commands; Rein turns
            them into cryptographically-bounded payments — within the limits
            you set, to payees you approve, nothing more.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <a href={APP_URL}>
              Try it <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
        <div className="flex justify-center md:justify-end">
          <AgentChatDemo />
        </div>
      </section>

      <section id="use-cases" className="border-t bg-neutral-50">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20">
          <div className="max-w-2xl mb-8 md:mb-10">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Use cases
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              For when an agent needs to spend money autonomously —
              without you holding your breath.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <UseCase
              icon={<Receipt className="h-5 w-5" />}
              title="Customer-support refunds"
              body="A bot handles tier-1 refund requests end to end. Rein caps it at $50 per refund, $5k per month, and restricts payees to addresses already in your payouts ledger. Your oncall sleeps."
            />
            <UseCase
              icon={<ShoppingCart className="h-5 w-5" />}
              title="Procurement agents"
              body="An agent subscribes to SaaS tools on behalf of each team. Per-team budget, payees restricted to your approved vendor list. Legal reviews the vendor list once; the agent handles the rest."
            />
            <UseCase
              icon={<Megaphone className="h-5 w-5" />}
              title="Ads budget management"
              body="An agent tunes spend across Meta, Google, and TikTok based on performance. Daily cap, monthly cap, and only the exact platform accounts your finance team pre-registered. No more 'what happened to my budget' mornings."
            />
            <UseCase
              icon={<Database className="h-5 w-5" />}
              title="Data & API purchases"
              body="An enrichment agent pays per call to data providers from an allow-list, with a per-provider cap. The agent scales freely with demand; the bill stays bounded by a rule you set once."
            />
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-start">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              A budget your agent physically can&rsquo;t exceed.
            </h2>
            <p className="mt-4 text-neutral-600 leading-relaxed">
              Most agent platforms enforce limits in application code. A rogue
              or compromised runtime can lie its way past them. Rein enforces
              every payment at the settlement layer: the agent&rsquo;s own
              credential is bounded by the limits you set, and unauthorized
              payments don&rsquo;t go through — ever. No rule to bypass,
              because the rule is the money.
            </p>
            <Button asChild className="mt-6" variant="outline">
              <a href={APP_URL}>
                Get started <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Agent
            </div>
            <div className="mt-3 font-medium">support-refunds</div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-neutral-500">Balance</div>
                <div className="font-medium tabular-nums">$2,000.00</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Spent this month</div>
                <div className="font-medium tabular-nums">$412.50</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">
                  Per-payment limit
                </div>
                <div className="font-medium tabular-nums">$50.00</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Monthly limit</div>
                <div className="font-medium tabular-nums">$2,000.00</div>
              </div>
            </div>
            <div className="mt-6 text-xs text-neutral-500">
              Payees: <span className="text-neutral-700">Stripe payouts</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-neutral-950 text-white">
        <div className="max-w-4xl mx-auto px-6 py-14 md:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to secure your AI agents?
          </h2>
          <p className="mt-4 text-neutral-300 text-lg max-w-2xl mx-auto">
            Book a 30-minute live demo with our team to learn how Rein can
            protect your business from costly mistakes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="mailto:hello@rein.dev?subject=Rein%20demo%20request">
                Book a demo <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-neutral-700 hover:bg-neutral-900 hover:text-white"
            >
              <a href={APP_URL}>Try it free</a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-neutral-500">
          <div>rein — spend control for AI agents</div>
          <a href={APP_URL} className="hover:text-foreground">
            Sign in
          </a>
        </div>
      </footer>
    </main>
  );
}

function UseCase({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="p-6 border rounded-lg bg-white">
      <div className="flex items-center gap-2 mb-3 text-foreground">
        <div className="text-neutral-500">{icon}</div>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
