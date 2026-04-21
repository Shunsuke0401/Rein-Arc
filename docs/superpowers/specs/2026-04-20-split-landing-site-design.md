# Split Landing Site Into Its Own App

**Status:** approved (2026-04-20)
**Shape:** A1 — add `rein-site/` as a subfolder of the existing `Shunsuke0401/rein` repo.

## Why

The product app (`rein-app/` — Next.js + Prisma + Turnkey + SQLite) can't be
deployed to Vercel as-is: SQLite needs a writable local filesystem that
Vercel's serverless runtime doesn't provide. We want the marketing landing
page live on Vercel now; the product keeps running locally until we swap
to a hosted database. Splitting out a dependency-free landing site lets
Vercel deploy the site today without touching the product.

## Shape

```
rein/                        (existing GitHub repo, unchanged history)
├── src/, prisma/, package.json, …   product app (untouched)
└── rein-site/                       new Next.js app — landing only
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── globals.css
    │   │   └── page.tsx
    │   ├── components/
    │   │   ├── hero.tsx
    │   │   ├── agent-chat-demo.tsx
    │   │   └── ui/
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── splite.tsx
    │   │       ├── spotlight.tsx
    │   │       ├── prompt-input.tsx
    │   │       └── tooltip.tsx
    │   └── lib/
    │       └── utils.ts
    ├── public/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── .env.example
    └── .gitignore
```

Vercel project Root Directory = `rein-site`. Framework preset: Next.js.
The product app remains at the repo root and is never deployed from this
Vercel project.

## What moves

**Copy** (never move — the product's landing-at-`/` must keep working locally):

| From (`rein-app/`) | To (`rein-site/`) |
| --- | --- |
| `src/app/page.tsx` | `src/app/page.tsx` |
| `src/app/layout.tsx` | `src/app/layout.tsx` |
| `src/app/globals.css` | `src/app/globals.css` |
| `src/components/hero.tsx` | `src/components/hero.tsx` |
| `src/components/agent-chat-demo.tsx` | `src/components/agent-chat-demo.tsx` |
| `src/components/ui/button.tsx` | `src/components/ui/button.tsx` |
| `src/components/ui/card.tsx` | `src/components/ui/card.tsx` |
| `src/components/ui/splite.tsx` | `src/components/ui/splite.tsx` |
| `src/components/ui/spotlight.tsx` | `src/components/ui/spotlight.tsx` |
| `src/components/ui/prompt-input.tsx` | `src/components/ui/prompt-input.tsx` |
| `src/components/ui/tooltip.tsx` | `src/components/ui/tooltip.tsx` |
| `src/lib/utils.ts` | `src/lib/utils.ts` |
| `postcss.config.mjs` | `postcss.config.mjs` |
| `tsconfig.json` (paths + jsx + `@/*` alias) | `tsconfig.json` (adapted) |
| `next.config.ts` (trim image domains etc.) | `next.config.ts` |

**Excluded** (never copied): `src/app/dashboard/*`, `src/app/login/*`,
`src/app/api/*`, `src/components/{credentials-modal,payee-form,agent-deposit-panel,agent-*}.tsx`,
anything under `src/lib/{turnkey,tempo,gas-tank,activity,agents,auth,prisma}.ts`,
`prisma/`, `scripts/`, `generated/`, `.env.local`.

## Dependencies

`rein-site/package.json` contains only what the landing actually imports:

```json
{
  "dependencies": {
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "@splinetool/react-spline": "^4.1.0",
    "@splinetool/runtime": "^1.12.86",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tooltip": "^1.2.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.8.0",
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

Explicitly absent: `prisma`, `@prisma/*`, `better-sqlite3`, `@turnkey/*`,
`viem`, `zod`, `react-hook-form`, `@hookform/resolvers`,
`@radix-ui/react-{dialog,label,popover,separator,toast}`, `server-only`,
`dotenv`, `tsx`.

## Link rewiring

Introduce `NEXT_PUBLIC_APP_URL` in `rein-site`. Empty / unset is allowed
and falls back to `#`.

| Current link in `rein-app/src/app/page.tsx` | New link in `rein-site` |
| --- | --- |
| `<Link href="/login">Sign in</Link>` | `<a href={process.env.NEXT_PUBLIC_APP_URL ?? "#"}>Sign in</a>` |
| `<Link href="/login">Get started</Link>` (hero) | same |
| `<Link href="/login">Try it</Link>` | same |
| `<Link href="/login">Try it free</Link>` | same |
| `<Link href="/login">Get started</Link>` (budget section) | same |
| `<a href="mailto:hello@rein.dev?subject=…">Book a demo</a>` | unchanged |
| `#how`, `#use-cases` | unchanged (same-page anchors) |

For external-URL CTAs we use plain `<a>` instead of `next/link` since
`next/link`'s prefetching has no value for an off-app destination.

## Config details

- `rein-site/tsconfig.json` mirrors `rein-app/tsconfig.json` — same
  `"paths": { "@/*": ["./src/*"] }` so the copied files' imports resolve
  unchanged.
- `rein-site/next.config.ts` is the default Next.js 16 config (no custom
  webpack, no image domains needed).
- `rein-site/postcss.config.mjs` is identical to `rein-app`'s.
- Tailwind 4 uses `@import "tailwindcss"` in `globals.css`; no separate
  `tailwind.config.ts` is required. Copy `globals.css` as-is.
- `.gitignore` for `rein-site/` covers `node_modules`, `.next`,
  `.env*.local`.

## Vocabulary

`rein-site` is the marketing surface. The strict vocabulary ban from
`rein-app/CLAUDE.md` applies to the authenticated product UI only.
Landing copy may retain its existing generic crypto nouns (e.g.
"programmable wallet"). The relaxed banned list from
`rein-app/scripts/smoke.ts` is the reference for what is NOT allowed
even on marketing: `Tempo`, `USDC`, `ETH`, `sub-org`, `Turnkey`,
`tx hash`, `transaction hash`, `private key`, `Access Key`, `EOA`,
`hex`.

A copy of the same relaxed list is documented in `rein-site/CLAUDE.md`
so the separation doesn't lose the invariant.

## Deployment

1. Vercel project settings:
   - Root Directory: `rein-site`
   - Framework: Next.js (auto-detected)
   - Node.js version: default (20.x)
   - Environment variables:
     - `NEXT_PUBLIC_APP_URL` — optional; unset for now.
2. Push to `main` → Vercel deploys automatically. Every PR gets a preview
   URL for copy review.
3. Custom domain (e.g. `rein.dev`) attached to the Vercel project once
   we're happy with the content.

## Out of scope

- No analytics, no lead capture form, no newsletter signup. The only
  lead-capture path is the existing `mailto:hello@rein.dev` "Book a
  demo" button.
- No SEO meta work beyond what the current `layout.tsx` provides. Title
  and description tweaks can follow in a separate change.
- No shared-packages refactor (`apps/` + `packages/`). The duplication
  of `utils.ts` + shadcn primitives is accepted; if it grows past three
  duplicated files we'll revisit with an `apps/*`-shaped monorepo.
- No removal of the landing page from `rein-app/`. The product repo
  keeps its landing at `/` so local dev continues to work end-to-end.
  We can remove it later once the Vercel deploy is the canonical
  marketing surface.

## Risks / open questions

- **Drift between the two copies of the landing.** Two copies of the
  same components means a design tweak requires editing both places
  until we delete the `rein-app/` copy. Accepted risk — we'll delete
  `rein-app/`'s landing once the Vercel site is canonical.
- **Spline scene URL** (`https://prod.spline.design/kZDDjO5HuC9GJUM2/…`)
  is hard-coded. If the scene is swapped, both copies must be updated
  until the `rein-app/` copy is removed.
- **Font setup.** `rein-app/src/app/layout.tsx` uses `next/font` (Geist).
  The copy should keep the same font import; verify visually after the
  first deploy.

## Acceptance criteria

1. `rein-site/` exists as a sibling of `rein-app/`'s current root
   contents, committed to the same `Shunsuke0401/rein` GitHub repo.
2. `cd rein-site && npm install && npm run dev` serves the landing page
   on its own port with no Prisma / Turnkey / sqlite code anywhere in
   the bundle.
3. `cd rein-site && npm run build` completes without touching any
   product code path. The build output imports zero product
   dependencies.
4. Vercel deploy of the `rein-site` folder renders identical output to
   the local `rein-app` landing page as of 2026-04-20.
5. The product app at the repo root still runs (`cd .. && npm run dev`)
   byte-identically to before the split.
