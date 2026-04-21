# Split Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `rein-site/` as a dependency-free Next.js app inside the existing `Shunsuke0401/rein` repo that renders the current landing page byte-identically, then push it so Vercel can deploy it from `rein-site/` as Root Directory.

**Architecture:** Shape A1 from the spec — `rein-site/` lives as a subfolder of the repo root (which is already `rein-app/` itself). The product stays untouched. The landing copies — not moves — all marketing files so the product's `/` route keeps working locally. Login/get-started CTAs are rewired to `process.env.NEXT_PUBLIC_APP_URL ?? "#"` since the product isn't deployed yet.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, shadcn-style primitives, Spline, framer-motion, lucide-react. No Prisma, no Turnkey, no viem, no sqlite, no zod, no react-hook-form.

**Repo context:**
- Git root: `/Users/nakatanishunsuke/Dev/Rein/rein-app/` (remote: `Shunsuke0401/rein`)
- All paths in this plan are relative to that git root unless noted
- Spec: `docs/superpowers/specs/2026-04-20-split-landing-site-design.md`

**Verification model:** No unit tests are introduced — this plan is a file-copy + wiring migration. Verification is (a) `npm run build` succeeds in `rein-site/`, (b) `npm run dev` in `rein-site/` renders a landing page visually identical to the product's `/` on localhost, (c) the product's `npm run dev` at the repo root still works unchanged.

---

### Task 1: Scaffold `rein-site/` config files

Set up the new Next.js app shell: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `next-env.d.ts`, `.env.example`. No components yet.

**Files:**
- Create: `rein-site/package.json`
- Create: `rein-site/tsconfig.json`
- Create: `rein-site/next.config.ts`
- Create: `rein-site/postcss.config.mjs`
- Create: `rein-site/.gitignore`
- Create: `rein-site/next-env.d.ts`
- Create: `rein-site/.env.example`

- [ ] **Step 1: Create the folder**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
mkdir -p rein-site/src/app rein-site/src/components/ui rein-site/src/lib rein-site/public
```

- [ ] **Step 2: Write `rein-site/package.json`**

```json
{
  "name": "rein-site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@splinetool/react-spline": "^4.1.0",
    "@splinetool/runtime": "^1.12.86",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.8.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Write `rein-site/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `rein-site/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* default config — landing page only */
};

export default nextConfig;
```

- [ ] **Step 5: Write `rein-site/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6: Write `rein-site/.gitignore`**

```gitignore
# dependencies
/node_modules

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env
.env*.local

# typescript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 7: Write `rein-site/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 8: Write `rein-site/.env.example`**

```bash
# Public URL of the Rein product app. Used by "Sign in" / "Get started"
# CTAs on the landing page. Leave unset to render "#" as the target.
NEXT_PUBLIC_APP_URL=
```

- [ ] **Step 9: Install deps**

Run:
```bash
cd rein-site && npm install
```

Expected: dependencies install without native-build failures. `node_modules/` appears. No `better-sqlite3`, no Prisma, no `@turnkey/*` in the tree.

- [ ] **Step 10: Commit**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git add rein-site/package.json rein-site/package-lock.json rein-site/tsconfig.json rein-site/next.config.ts rein-site/postcss.config.mjs rein-site/.gitignore rein-site/next-env.d.ts rein-site/.env.example
git commit -m "chore(rein-site): scaffold config for landing-only Next.js app

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Copy shared utilities and UI primitives

Copy the shadcn-style primitives and the `cn` helper that hero/page depend on. These are pure presentational components with no product-side imports.

**Files:**
- Create: `rein-site/src/lib/utils.ts` (copy from `src/lib/utils.ts`)
- Create: `rein-site/src/components/ui/button.tsx` (copy from `src/components/ui/button.tsx`)
- Create: `rein-site/src/components/ui/card.tsx` (copy from `src/components/ui/card.tsx`)
- Create: `rein-site/src/components/ui/splite.tsx` (copy from `src/components/ui/splite.tsx`)
- Create: `rein-site/src/components/ui/spotlight.tsx` (copy from `src/components/ui/spotlight.tsx`)
- Create: `rein-site/src/components/ui/prompt-input.tsx` (copy from `src/components/ui/prompt-input.tsx`)
- Create: `rein-site/src/components/ui/tooltip.tsx` (copy from `src/components/ui/tooltip.tsx`)

- [ ] **Step 1: Copy the files byte-for-byte**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
cp src/lib/utils.ts rein-site/src/lib/utils.ts
cp src/components/ui/button.tsx rein-site/src/components/ui/button.tsx
cp src/components/ui/card.tsx rein-site/src/components/ui/card.tsx
cp src/components/ui/splite.tsx rein-site/src/components/ui/splite.tsx
cp src/components/ui/spotlight.tsx rein-site/src/components/ui/spotlight.tsx
cp src/components/ui/prompt-input.tsx rein-site/src/components/ui/prompt-input.tsx
cp src/components/ui/tooltip.tsx rein-site/src/components/ui/tooltip.tsx
```

- [ ] **Step 2: Verify no cross-folder imports leaked in**

Run:
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app/rein-site
grep -R "from \"@/components/" src/components/ui src/lib || true
grep -R "from \"@/lib/" src/components/ui || true
```

Expected: the only allowed import is `@/lib/utils` from UI primitives. If any file imports `@/components/credentials-modal` or anything product-related, that file was the wrong one — stop and investigate.

- [ ] **Step 3: Commit**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git add rein-site/src/lib rein-site/src/components/ui
git commit -m "chore(rein-site): copy shadcn primitives and cn helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Copy the landing-specific components

Copy `hero.tsx` and `agent-chat-demo.tsx`. These only depend on the UI primitives already in place.

**Files:**
- Create: `rein-site/src/components/hero.tsx` (copy from `src/components/hero.tsx`)
- Create: `rein-site/src/components/agent-chat-demo.tsx` (copy from `src/components/agent-chat-demo.tsx`)

- [ ] **Step 1: Copy the files**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
cp src/components/hero.tsx rein-site/src/components/hero.tsx
cp src/components/agent-chat-demo.tsx rein-site/src/components/agent-chat-demo.tsx
```

- [ ] **Step 2: Sanity-check imports**

Run:
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app/rein-site
grep -nH "^import" src/components/hero.tsx src/components/agent-chat-demo.tsx
```

Expected: imports reference only `next/link`, `@/components/ui/*`, `lucide-react`, `framer-motion`, and React itself. If anything else appears (e.g. `@/lib/api`, `@/components/credentials-modal`), stop and reconcile.

- [ ] **Step 3: Commit**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git add rein-site/src/components/hero.tsx rein-site/src/components/agent-chat-demo.tsx
git commit -m "chore(rein-site): copy hero and agent-chat-demo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Write the landing-only `layout.tsx`

The product's `src/app/layout.tsx` imports `ToastRoot` from `@/components/ui/use-toast`, which depends on product state. The landing doesn't need toasts, so we write a stripped-down layout that keeps the Geist fonts + metadata but drops `ToastRoot`.

**Files:**
- Create: `rein-site/src/app/layout.tsx`

- [ ] **Step 1: Write `rein-site/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rein — Spend-control layer for AI agents",
  description:
    "Rein is secure payments infrastructure for AI agents. Every action an agent takes is guardrailed by cryptography.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Copy `globals.css` verbatim**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
cp src/app/globals.css rein-site/src/app/globals.css
```

- [ ] **Step 3: Commit**

```bash
git add rein-site/src/app/layout.tsx rein-site/src/app/globals.css
git commit -m "chore(rein-site): add root layout and globals.css

Drops ToastRoot from the product layout; landing has no toasts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Write `page.tsx` with CTAs rewired to `NEXT_PUBLIC_APP_URL`

This is the one file that gets adapted instead of copied. All `<Link href="/login">…</Link>` CTAs become `<a href={process.env.NEXT_PUBLIC_APP_URL ?? "#"}>…</a>`. Same-page anchors (`#how`, `#use-cases`) and the `mailto:` demo link stay put. The `<Link href="/">rein</Link>` nav logo stays as `<Link>` since it's a same-app anchor.

**Files:**
- Create: `rein-site/src/app/page.tsx`

- [ ] **Step 1: Write `rein-site/src/app/page.tsx`**

```tsx
import Link from "next/link";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "#";

export default function LandingPage() {
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
```

- [ ] **Step 2: Update `Hero` to accept an `appUrl` prop**

The copied `rein-site/src/components/hero.tsx` still points "Get started" at `/login`. Replace that CTA to use the passed-in URL so the hero stays self-contained and the `APP_URL` env resolution happens once in `page.tsx`.

Edit `rein-site/src/components/hero.tsx`:

Replace:
```tsx
export function Hero() {
  return (
```
with:
```tsx
export function Hero({ appUrl }: { appUrl: string }) {
  return (
```

Replace:
```tsx
            <Button asChild size="lg">
              <Link href="/login">Get started</Link>
            </Button>
```
with:
```tsx
            <Button asChild size="lg">
              <a href={appUrl}>Get started</a>
            </Button>
```

Then remove the now-unused `Link` import at the top:
```tsx
import Link from "next/link";
```
Delete that line (and if prettier complains about the blank line, leave a single blank).

- [ ] **Step 3: Verify no `/login` refs remain**

Run:
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app/rein-site
grep -RIn "/login" src || true
```

Expected: no matches. If any remain, fix them (swap to `{appUrl}` or `{APP_URL}` as appropriate for that file).

- [ ] **Step 4: Commit**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git add rein-site/src/app/page.tsx rein-site/src/components/hero.tsx
git commit -m "chore(rein-site): add landing page.tsx with CTAs rewired to NEXT_PUBLIC_APP_URL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add `rein-site/CLAUDE.md` with the relaxed vocab rules

Document the relaxed vocabulary ban so future AI edits don't drift marketing copy into product-internal jargon.

**Files:**
- Create: `rein-site/CLAUDE.md`

- [ ] **Step 1: Write `rein-site/CLAUDE.md`**

```markdown
# rein-site (marketing)

This is the marketing landing page for Rein, deployed from `rein-site/` on
Vercel. It is intentionally dependency-free (no Prisma, Turnkey, viem, or
sqlite) so it can ship without the product's hosted-DB dependency.

## Vocabulary

The strict `rein-app` vocabulary ban does NOT apply here; marketing copy
is allowed to use generic crypto nouns like "programmable wallet" and
"cryptography". However the following product-internal terms must NEVER
appear in any rendered text on this site:

`Tempo`, `USDC`, `ETH`, `sub-org`, `Turnkey`, `tx hash`,
`transaction hash`, `private key`, `Access Key`, `EOA`, `hex`.

## External links

All "Sign in" / "Get started" / "Try it" / "Try it free" CTAs resolve to
`process.env.NEXT_PUBLIC_APP_URL ?? "#"`. The "Book a demo" CTA is a
`mailto:hello@rein.dev` link. Same-page anchors (`#how`, `#use-cases`)
stay internal.

When the product app gets a public URL, set `NEXT_PUBLIC_APP_URL` in the
Vercel project settings — no code change needed.

## What lives where

- `src/app/page.tsx` — landing copy.
- `src/app/layout.tsx` — Geist fonts + metadata. No toast provider.
- `src/components/hero.tsx` — top hero with Spline robot and "Get started" CTA.
- `src/components/agent-chat-demo.tsx` — animated chat on the "How it works" section.
- `src/components/ui/*` — shadcn-style primitives (button, card, splite, spotlight, prompt-input, tooltip).
- `src/lib/utils.ts` — `cn` helper.

## Drift with rein-app

Until the product's landing at `/` is retired, the same files exist in
both `rein-app/src/components/` and `rein-site/src/components/`. Any
design tweak has to be applied in both places. Once we're confident the
Vercel site is canonical, delete the `rein-app/` landing copy.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git add rein-site/CLAUDE.md
git commit -m "docs(rein-site): add CLAUDE.md with relaxed vocab + link rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Build and run verification

Confirm the new app compiles and serves a visually-identical landing page. The product must still run unchanged.

**Files:** (none changed — verification only)

- [ ] **Step 1: Build `rein-site`**

Run:
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app/rein-site
npm run build
```

Expected: Next.js build completes with a "Collecting page data" → "Generating static pages" → "Finalizing" sequence. Zero errors. The output summary shows one route: `/` (Static).

If it fails on a missing module, the most likely cause is a stray product-side import inside one of the copied components. Re-check the culprit file against the original in `rein-app/src/components/`.

- [ ] **Step 2: Run the dev server and visually confirm**

Run (in one terminal):
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app/rein-site
npm run dev -- -p 3457
```

Open `http://localhost:3457` in a browser. Confirm:
- Hero renders with "Don't trust your agent. Trust the math." + Spline robot on desktop.
- Chat demo animates through the four prompts.
- Use-cases grid renders with all four cards.
- "Get started" / "Sign in" / "Try it free" either navigate to `#` (no env set) or to the URL you'd set via `NEXT_PUBLIC_APP_URL`.
- "Book a demo" opens a `mailto:` composer.

Stop the dev server (`Ctrl-C`).

- [ ] **Step 3: Confirm the product still runs unchanged**

Run (in a second terminal or after stopping the site's dev server):
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
npm run dev
```

Open `http://localhost:3456`. Confirm landing at `/` still renders as before, and clicking "Get started" still navigates to the product's `/login`. Stop the server.

- [ ] **Step 4: No commit yet — verification only**

This task has no file changes. Move to Task 8.

---

### Task 8: Push and hand off to Vercel

Push the full set of new commits (scaffold, primitives, components, layout, page, CLAUDE.md) to `origin/main`.

**Files:** (none changed)

- [ ] **Step 1: Verify git status is clean**

Run:
```bash
cd /Users/nakatanishunsuke/Dev/Rein/rein-app
git status
```

Expected: `nothing to commit, working tree clean`. If anything is staged or modified, commit or revert before pushing.

- [ ] **Step 2: Show the commits that will be pushed**

Run:
```bash
git log --oneline origin/main..HEAD
```

Expected: six commits (Tasks 1, 2, 3, 4, 5, 6 each produced one commit).

- [ ] **Step 3: Push**

Run:
```bash
git push origin main
```

Expected: push succeeds; remote updated.

- [ ] **Step 4: Inform the user that Vercel can now be created**

Report to the user:
> `rein-site/` is live on `origin/main`. In Vercel: create a new project from `Shunsuke0401/rein`, set Root Directory to `rein-site`, keep the Next.js preset, optionally set `NEXT_PUBLIC_APP_URL`, deploy.
