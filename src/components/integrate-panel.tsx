"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Language = "node" | "python" | "curl";

export function IntegratePanel({
  agentName,
  firstPayeeLabel,
  hasPermission,
}: {
  agentName: string;
  firstPayeeLabel?: string;
  hasPermission: boolean;
}) {
  const [lang, setLang] = React.useState<Language>("node");
  const payee = firstPayeeLabel ?? "a-payee-label";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrate this agent</h2>
        <p className="text-sm text-neutral-600 mt-0.5">
          Give your AI agent a bounded way to spend {agentName}&rsquo;s balance.
          The caps you set are enforced on chain — a compromised caller
          can&rsquo;t overspend.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Install the SDK</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock value="npm install rein-sdk" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Set your API key</CardTitle>
          <CardDescription>
            Paste the value from the one-shot credentials modal you saw when
            you created this agent. If you lost it, create a new agent — we
            don&rsquo;t store secrets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-neutral-50 p-3 font-mono text-xs break-all text-neutral-500 border">
            REIN_API_KEY=rein_••••••••••••••••••••••••••••
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Send a payment</CardTitle>
          <CardDescription>
            {firstPayeeLabel ? (
              <>
                Using saved payee{" "}
                <span className="font-medium text-foreground">
                  {firstPayeeLabel}
                </span>
                .
              </>
            ) : (
              <>
                Add a payee on the Payees tab to see a real example here. The
                snippet below uses a placeholder label.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1 text-xs">
            <LangTab id="node" active={lang === "node"} onClick={() => setLang("node")}>
              Node.js
            </LangTab>
            <LangTab id="python" active={lang === "python"} onClick={() => setLang("python")}>
              Python
            </LangTab>
            <LangTab id="curl" active={lang === "curl"} onClick={() => setLang("curl")}>
              cURL
            </LangTab>
          </div>
          <CodeBlock value={snippet(lang, baseUrl, payee)} />
          {!hasPermission ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              This agent has no active API key yet. Create a permission from
              the Permissions tab to get a key.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. What gets enforced</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600 space-y-2">
          <Row>Every call goes through the session key installed on this agent&rsquo;s smart account.</Row>
          <Row>Amounts over the per-payment cap are rejected by the smart account itself.</Row>
          <Row>Recipients outside the payee allow-list revert on chain.</Row>
          <Row>Monthly rate-limit is encoded on-chain too — the bundler stops accepting new calls once you hit it.</Row>
        </CardContent>
      </Card>
    </div>
  );
}

function LangTab({
  active,
  children,
  onClick,
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "px-3 py-1.5 rounded-md bg-foreground text-background font-medium"
          : "px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-100"
      }
    >
      {children}
    </button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="h-4 w-4 text-foreground mt-0.5 flex-none" />
      <span>{children}</span>
    </div>
  );
}

function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative">
      <pre className="rounded-md border bg-neutral-950 text-neutral-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono">
        {value}
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={copy}
        className="absolute top-2 right-2 bg-background"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Copy
          </>
        )}
      </Button>
    </div>
  );
}

function snippet(lang: Language, baseUrl: string, payee: string): string {
  if (lang === "node") {
    return [
      `import { Rein } from "rein-sdk";`,
      ``,
      `const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });`,
      ``,
      `const payment = await rein.payments.create({`,
      `  to: "${payee}",`,
      `  amountUsd: 5,`,
      `});`,
      ``,
      `console.log(payment.status); // "confirmed"`,
    ].join("\n");
  }
  if (lang === "python") {
    return [
      `import os, httpx`,
      ``,
      `r = httpx.post(`,
      `    "${baseUrl}/api/v1/payments",`,
      `    headers={"authorization": f"Bearer {os.environ['REIN_API_KEY']}"},`,
      `    json={"to": "${payee}", "amountUsd": 5},`,
      `    timeout=30,`,
      `)`,
      `r.raise_for_status()`,
      `print(r.json())`,
    ].join("\n");
  }
  return [
    `curl -sS -X POST ${baseUrl}/api/v1/payments \\`,
    `  -H "authorization: Bearer $REIN_API_KEY" \\`,
    `  -H "content-type: application/json" \\`,
    `  -d '{"to":"${payee}","amountUsd":5}'`,
  ].join("\n");
}
