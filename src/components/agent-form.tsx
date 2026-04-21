"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  CredentialsModal,
  type CredentialsPayload,
} from "@/components/credentials-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type PayeeRow = { label: string; address: string };

export function AgentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [credentials, setCredentials] = React.useState<
    | {
        payload: CredentialsPayload;
        agentName: string;
        agentId: string;
      }
    | null
  >(null);

  const [name, setName] = React.useState("");
  const [perPayment, setPerPayment] = React.useState("50");
  const [monthly, setMonthly] = React.useState("2000");
  const [payees, setPayees] = React.useState<PayeeRow[]>([]);

  function addPayee() {
    setPayees((p) => [...p, { label: "", address: "" }]);
  }
  function removePayee(i: number) {
    setPayees((p) => p.filter((_, idx) => idx !== i));
  }
  function updatePayee(i: number, patch: Partial<PayeeRow>) {
    setPayees((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name,
        perPaymentLimitUsd: Number(perPayment),
        monthlyLimitUsd: Number(monthly),
        payees: payees.filter((p) => p.label.trim() && p.address.trim()),
      };
      const resp = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Couldn't create agent");
      setCredentials({
        payload: data.credentials,
        agentName: data.agent.name,
        agentId: data.agent.id,
      });
      toast({
        title: "Agent created",
        description: "Copy the API key before closing.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't create agent",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function onAck() {
    const agentId = credentials?.agentId;
    setCredentials(null);
    if (agentId) router.push(`/dashboard/agents/${agentId}`);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
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
          <p className="text-xs text-neutral-500">
            A human-readable name. Shown in activity logs.
          </p>
        </div>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Payees</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addPayee}
              disabled={busy}
            >
              <Plus className="h-3 w-3" /> Add payee
            </Button>
          </div>
          {payees.length === 0 ? (
            <div className="rounded-md border p-3 text-xs text-neutral-500">
              No payees yet. You can add them later from the agent page.
            </div>
          ) : (
            <div className="space-y-2">
              {payees.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    placeholder="Label (e.g. Stripe payouts)"
                    value={p.label}
                    onChange={(e) => updatePayee(i, { label: e.target.value })}
                    maxLength={40}
                    disabled={busy}
                    className="flex-1"
                  />
                  <Input
                    placeholder="0x…"
                    value={p.address}
                    onChange={(e) => updatePayee(i, { address: e.target.value })}
                    disabled={busy}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removePayee(i)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} asChild>
            <a href="/dashboard/agents">Cancel</a>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>Create agent &amp; API key</>
            )}
          </Button>
        </div>
      </form>

      {credentials ? (
        <CredentialsModal
          credentials={credentials.payload}
          permissionName={credentials.agentName}
          onAcknowledge={onAck}
        />
      ) : null}
    </>
  );
}
