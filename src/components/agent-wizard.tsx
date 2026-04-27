"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Banknote,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import QRCode from "qrcode";

import {
  CredentialsModal,
  type CredentialsPayload,
} from "@/components/credentials-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type Step = 1 | 2 | 3 | 4;
type PayeeDraft = { label: string; address: string };
type SavedPayee = { id: string; label: string };

type StepMeta = {
  id: Step;
  title: string;
  caption: string;
  Icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
};

const STEPS: StepMeta[] = [
  {
    id: 1,
    title: "Name the agent",
    caption: "Pick something you'll recognize in activity logs.",
    Icon: Tag,
  },
  {
    id: 2,
    title: "Fund the agent",
    caption: "Send funds to the deposit address, or skip and fund later.",
    Icon: Banknote,
  },
  {
    id: 3,
    title: "Add payees",
    caption:
      "Addresses the agent is allowed to pay. Skip to leave the agent unrestricted.",
    Icon: Users,
  },
  {
    id: 4,
    title: "Generate your agent's API key",
    caption:
      "Set the spending caps. You'll get a one-shot API key to paste into your AI agent.",
    Icon: KeyRound,
  },
];

export function AgentWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStepRaw] = React.useState<Step>(1);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const setStep = React.useCallback((next: Step) => {
    setStepRaw((prev) => {
      setDirection(next > prev ? 1 : -1);
      return next;
    });
  }, []);
  const [busy, setBusy] = React.useState(false);
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [agentName, setAgentName] = React.useState("");
  const [savedPayees, setSavedPayees] = React.useState<SavedPayee[]>([]);
  const [credentials, setCredentials] =
    React.useState<{ payload: CredentialsPayload; name: string } | null>(null);

  return (
    <>
      <ol className="flex items-center gap-2 mb-8 text-xs">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              step === s.id
                ? "border-foreground bg-foreground text-background"
                : step > s.id
                ? "border-neutral-300 bg-neutral-100 text-neutral-600"
                : "border-neutral-200 text-neutral-500"
            }`}
          >
            <span className="font-medium">
              {step > s.id ? "✓" : s.id}
            </span>
            <span>{s.title}</span>
          </li>
        ))}
      </ol>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {step === 1 && (
            <SlidePanel key="step-1" direction={direction}>
              <StepName
                busy={busy}
                onSubmit={async (name) => {
                  setBusy(true);
                  try {
                    const resp = await fetch("/api/agents", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error ?? "Couldn't create agent");
                    setAgentId(data.agent.id);
                    setAgentName(data.agent.name);
                    setStep(2);
                  } catch (err) {
                    toast({
                      title: "Couldn't create agent",
                      description: err instanceof Error ? err.message : "Unknown",
                      variant: "destructive",
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </SlidePanel>
          )}

          {step === 2 && agentId && (
            <SlidePanel key="step-2" direction={direction}>
              <StepDeposit
                agentId={agentId}
                agentName={agentName}
                onContinue={() => setStep(3)}
                onSkip={() => setStep(3)}
              />
            </SlidePanel>
          )}

          {step === 3 && agentId && (
            <SlidePanel key="step-3" direction={direction}>
              <StepPayees
                agentId={agentId}
                busy={busy}
                onBack={() => setStep(2)}
                onAddPayees={async (drafts) => {
                  setBusy(true);
                  try {
                    const added: SavedPayee[] = [];
                    for (const d of drafts) {
                      const resp = await fetch(`/api/agents/${agentId}/payees`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ label: d.label, address: d.address }),
                      });
                      const body = await resp.json();
                      if (!resp.ok) throw new Error(body.error ?? "Payee failed");
                      added.push({ id: body.payee.id, label: body.payee.label });
                    }
                    setSavedPayees((prev) => [...prev, ...added]);
                    setStep(4);
                  } catch (err) {
                    toast({
                      title: "Couldn't save payees",
                      description: err instanceof Error ? err.message : "Unknown",
                      variant: "destructive",
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
                onSkip={() => setStep(4)}
              />
            </SlidePanel>
          )}

          {step === 4 && agentId && (
            <SlidePanel key="step-4" direction={direction}>
              <StepPermission
                agentId={agentId}
                agentName={agentName}
                savedPayees={savedPayees}
                busy={busy}
                onBack={() => setStep(3)}
                onCreate={async ({ perPayment, monthly }) => {
                  setBusy(true);
                  try {
                    const resp = await fetch(`/api/agents/${agentId}/permissions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: `${agentName} key`,
                        perPaymentLimitUsd: perPayment,
                        monthlyLimitUsd: monthly,
                        payeeIds: savedPayees.map((p) => p.id),
                        allowedOperations: ["send_payment"],
                      }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error ?? "Permission failed");
                    setCredentials({ payload: data.credentials, name: agentName });
                    toast({
                      title: "Agent created",
                      description: "Copy the API key before closing.",
                      variant: "success",
                    });
                  } catch (err) {
                    toast({
                      title: "Couldn't create API key",
                      description: err instanceof Error ? err.message : "Unknown",
                      variant: "destructive",
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
                onSkip={() => {
                  if (agentId) router.push(`/dashboard/agents/${agentId}`);
                }}
              />
            </SlidePanel>
          )}
        </AnimatePresence>
      </div>

      {credentials ? (
        <CredentialsModal
          credentials={credentials.payload}
          permissionName={credentials.name}
          onAcknowledge={() => {
            setCredentials(null);
            if (agentId) router.push(`/dashboard/agents/${agentId}`);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

// -----------------------------------------------------------------------------
// Slide wrapper
// -----------------------------------------------------------------------------

function SlidePanel({
  direction,
  children,
}: {
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ x: direction === 1 ? 48 : -48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: direction === 1 ? -48 : 48, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Step 1 — Name
// -----------------------------------------------------------------------------

function StepName({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState("");
  return (
    <StepCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name);
        }}
        className="space-y-6"
      >
        <StepHeader step={1} />
        <div className="space-y-2">
          <Label htmlFor="name">Agent name</Label>
          <Input
            id="name"
            placeholder="support-refunds"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            Shown in activity logs. Can&rsquo;t be changed later.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" disabled={busy} asChild>
            <a href="/dashboard/agents">Cancel</a>
          </Button>
          <Button type="submit" disabled={busy || !name.trim()} className="min-w-32">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>Continue</>
            )}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}

// -----------------------------------------------------------------------------
// Step 2 — Fund (fetch deposit address + QR)
// -----------------------------------------------------------------------------

function StepDeposit({
  agentId,
  agentName,
  onContinue,
  onSkip,
}: {
  agentId: string;
  agentName: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const [address, setAddress] = React.useState<string | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/agents/${agentId}/deposit-address`);
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Failed");
        const addr = body.depositAddress ?? body.address;
        if (!addr) throw new Error("No deposit address in response");
        setAddress(addr);
        const png = await QRCode.toDataURL(addr, { margin: 1, width: 200 });
        setQr(png);
      } catch (err) {
        toast({
          title: "Couldn't load deposit address",
          description: err instanceof Error ? err.message : "Unknown",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [agentId, toast]);

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <StepCard>
      <div className="space-y-6">
        <StepHeader step={2} />
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <div>
            <Label className="text-xs font-medium text-foreground">
              Deposit address for {agentName}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Send funds to this address. Fund now or later — you can
              reveal this again from the agent page.
            </p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : address ? (
            <div className="flex items-start gap-4">
              {qr ? (
                <img
                  src={qr}
                  alt=""
                  className="h-32 w-32 rounded-md border border-border bg-white"
                  width={128}
                  height={128}
                />
              ) : null}
              <div className="flex-1 space-y-2">
                <div className="rounded-lg border border-border bg-background p-2 text-xs font-mono break-all">
                  {address}
                </div>
                <Button size="sm" variant="outline" onClick={copy}>
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
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="button" onClick={onContinue} className="min-w-32">
            Continue
          </Button>
        </div>
      </div>
    </StepCard>
  );
}

// -----------------------------------------------------------------------------
// Step 3 — Payees
// -----------------------------------------------------------------------------

function StepPayees({
  agentId: _agentId,
  busy,
  onAddPayees,
  onSkip,
  onBack,
}: {
  agentId: string;
  busy: boolean;
  onAddPayees: (drafts: PayeeDraft[]) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [rows, setRows] = React.useState<PayeeDraft[]>([
    { label: "", address: "" },
  ]);

  function update(i: number, patch: Partial<PayeeDraft>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function add() {
    setRows((r) => [...r, { label: "", address: "" }]);
  }

  const valid = rows.some((r) => r.label.trim() && r.address.trim());

  return (
    <StepCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const drafts = rows.filter((r) => r.label.trim() && r.address.trim());
          onAddPayees(drafts);
        }}
        className="space-y-6"
      >
        <StepHeader step={3} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Payees</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={add}
              disabled={busy}
            >
              <Plus className="h-3 w-3" /> Add row
            </Button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  placeholder="Label (e.g. Stripe payouts)"
                  value={r.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  maxLength={40}
                  disabled={busy}
                  className="flex-1"
                />
                <Input
                  placeholder="0x…"
                  value={r.address}
                  onChange={(e) => update(i, { address: e.target.value })}
                  disabled={busy}
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(i)}
                  disabled={busy || rows.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The agent can only pay these addresses. If you skip, payments go to
            any address up to the spending caps.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
              Skip for now
            </Button>
            <Button type="submit" disabled={busy || !valid} className="min-w-32">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>Continue</>
              )}
            </Button>
          </div>
        </div>
      </form>
    </StepCard>
  );
}

// -----------------------------------------------------------------------------
// Step 4 — Permission caps
// -----------------------------------------------------------------------------

function StepPermission({
  agentId: _agentId,
  agentName,
  savedPayees,
  busy,
  onCreate,
  onSkip,
  onBack,
}: {
  agentId: string;
  agentName: string;
  savedPayees: SavedPayee[];
  busy: boolean;
  onCreate: (p: { perPayment: number; monthly: number }) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [perPayment, setPerPayment] = React.useState("50");
  const [monthly, setMonthly] = React.useState("2000");

  return (
    <StepCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ perPayment: Number(perPayment), monthly: Number(monthly) });
        }}
        className="space-y-6"
      >
        <StepHeader step={4} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="perPayment">Per-payment limit (USD)</Label>
            <Input
              id="perPayment"
              type="number"
              min="0.01"
              step="0.01"
              value={perPayment}
              onChange={(e) => setPerPayment(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly">Monthly limit (USD)</Label>
            <Input
              id="monthly"
              type="number"
              min="0.01"
              step="0.01"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              required
              disabled={busy}
            />
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          <BadgeCheck className="h-4 w-4 flex-none text-foreground mt-0.5" />
          <div>
            <div className="font-medium text-foreground mb-1">
              What gets enforced
            </div>
            {savedPayees.length > 0 ? (
              <div>
                {agentName} can only pay{" "}
                <span className="font-medium text-foreground">
                  {savedPayees.map((p) => p.label).join(", ")}
                </span>
                , up to the per-payment cap, up to the monthly cap.
              </div>
            ) : (
              <div>
                {agentName} can pay any recipient, up to the per-payment cap,
                up to the monthly cap.
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
              Skip for now
            </Button>
            <Button type="submit" disabled={busy} className="min-w-40">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>Create API key</>
              )}
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          You&rsquo;ll get a one-shot API key. Save it before closing.
        </p>
      </form>
    </StepCard>
  );
}

// -----------------------------------------------------------------------------
// Shared step header (dialog-style icon badge + title + description)
// -----------------------------------------------------------------------------

function StepHeader({ step }: { step: Step }) {
  const meta = STEPS.find((s) => s.id === step)!;
  const Icon = meta.Icon;
  return (
    <div className="mb-2 flex flex-col gap-3">
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
        aria-hidden="true"
      >
        <Icon className="opacity-80" size={18} strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-left">
          {meta.title}
        </h2>
        <p className="text-sm text-muted-foreground text-left">
          {meta.caption}
        </p>
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm shadow-black/5 sm:p-8">
      {children}
    </div>
  );
}
