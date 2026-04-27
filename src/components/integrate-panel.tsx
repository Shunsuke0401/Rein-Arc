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
  firstPayeeAddress,
  hasPermission,
}: {
  agentName: string;
  firstPayeeLabel?: string;
  firstPayeeAddress?: string;
  hasPermission: boolean;
}) {
  const [lang, setLang] = React.useState<Language>("node");
  const payeeAddress =
    firstPayeeAddress ?? "0x0000000000000000000000000000000000000000";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrate this agent</h2>
        <p className="text-sm text-neutral-600 mt-0.5">
          Give your AI agent a bounded way to spend {agentName}&rsquo;s balance.
          The caps you set are enforced cryptographically — a compromised
          caller can&rsquo;t overspend.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Install</CardTitle>
          <CardDescription>{installDescription(lang)}</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock value={installCommand(lang)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Set your API key</CardTitle>
          <CardDescription>
            Save the one-shot credentials from when you created this agent
            into a <code className="font-mono text-xs">.env</code> file in
            your project. If you lost them, create a new agent — we don&rsquo;t
            store secrets.
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
            {firstPayeeAddress ? (
              <>
                Sending to{" "}
                <span className="font-medium text-foreground">
                  {firstPayeeLabel ?? firstPayeeAddress.slice(0, 10) + "…"}
                </span>
                . Only raw <code className="font-mono text-xs">0x</code>
                -addresses are accepted — labels were removed to keep recipient
                resolution off the server.
              </>
            ) : (
              <>
                Add a payee on the Payees tab to see a real example here. The
                snippet below uses a placeholder address.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock value={snippet(lang, baseUrl, payeeAddress)} />
          {!hasPermission ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              This agent has no active API key yet. Create a permission from
              the Permissions tab to get a key.
            </p>
          ) : null}
          <p className="text-xs text-neutral-500">
            Heads-up: the very first payment for a new agent takes ~20-40s
            while the agent is being provisioned. Subsequent calls return
            in a few seconds.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. What gets enforced</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600 space-y-2">
          <Row>Every call is signed with this permission&rsquo;s scoped credential.</Row>
          <Row>Amounts over the per-payment cap are rejected before any money moves.</Row>
          <Row>Recipients outside the payee allow-list are rejected.</Row>
          <Row>The monthly cap is enforced the same way — once you hit it, new calls fail until the cap resets.</Row>
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

function installCommand(lang: Language): string {
  if (lang === "node") return "npm install rein-sdk dotenv";
  if (lang === "python") return "pip install httpx python-dotenv";
  return "# cURL is built-in on macOS and Linux — nothing to install.";
}

function installDescription(lang: Language): string {
  if (lang === "node") {
    return "rein-sdk is the official client; dotenv loads your API key from .env at runtime.";
  }
  if (lang === "python") {
    return "There is no official Python SDK yet — the API is plain HTTPS, so httpx (or requests) plus python-dotenv is enough.";
  }
  return "Skip ahead.";
}

function snippet(lang: Language, baseUrl: string, payee: string): string {
  if (lang === "node") {
    return [
      `import "dotenv/config";`,
      `import { Rein, ReinError } from "rein-sdk";`,
      ``,
      `const rein = new Rein({ apiKey: process.env.REIN_API_KEY! });`,
      ``,
      `try {`,
      `  const payment = await rein.payments.create({`,
      `    to: "${payee}",`,
      `    amountUsd: 5,`,
      `  });`,
      `  console.log(payment.status); // "confirmed"`,
      `} catch (err) {`,
      `  if (err instanceof ReinError) {`,
      `    console.error(\`[\${err.code}] \${err.message}\`);`,
      `    process.exit(1);`,
      `  }`,
      `  throw err;`,
      `}`,
    ].join("\n");
  }
  if (lang === "python") {
    return [
      `import os`,
      `import httpx`,
      `from dotenv import load_dotenv`,
      ``,
      `load_dotenv()  # reads REIN_API_KEY from .env in the current dir`,
      ``,
      `r = httpx.post(`,
      `    "${baseUrl}/api/v1/payments",`,
      `    headers={"authorization": f"Bearer {os.environ['REIN_API_KEY']}"},`,
      `    json={"to": "${payee}", "amountUsd": 5},`,
      `    # First payment for a new agent provisions the agent — it can`,
      `    # take 20-40s. Stay above the server's 180s receipt wait.`,
      `    timeout=200,`,
      `)`,
      `print(r.status_code, r.json())`,
      `r.raise_for_status()`,
    ].join("\n");
  }
  return [
    `curl -sS -X POST ${baseUrl}/api/v1/payments \\`,
    `  -H "authorization: Bearer $REIN_API_KEY" \\`,
    `  -H "content-type: application/json" \\`,
    `  --max-time 200 \\`,
    `  -d '{"to":"${payee}","amountUsd":5}'`,
  ].join("\n");
}
