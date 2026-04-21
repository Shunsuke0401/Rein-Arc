"use client";

import { Loader2 } from "lucide-react";
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

const OPERATIONS = [
  {
    id: "send_payment",
    label: "Send payment",
    body: "Move money to an allowed payee.",
  },
  {
    id: "approve_vendor",
    label: "Approve vendor",
    body: "Pre-authorize a payee to pull funds (use with care).",
  },
  {
    id: "receive_refund",
    label: "Receive refund",
    body: "Let a payee return money to this agent.",
  },
] as const;

type Op = (typeof OPERATIONS)[number]["id"];

export function PermissionForm({
  agentId,
  agentName,
  payees,
}: {
  agentId: string;
  agentName: string;
  payees: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [credentials, setCredentials] =
    React.useState<{
      payload: CredentialsPayload;
      name: string;
    } | null>(null);

  const [name, setName] = React.useState("");
  const [perPayment, setPerPayment] = React.useState("50");
  const [monthly, setMonthly] = React.useState("2000");
  const [selectedPayees, setSelectedPayees] = React.useState<string[]>(
    payees.map((p) => p.id),
  );
  const [selectedOps, setSelectedOps] = React.useState<Record<Op, boolean>>({
    send_payment: true,
    approve_vendor: false,
    receive_refund: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allowedOperations = (Object.keys(selectedOps) as Op[]).filter(
      (k) => selectedOps[k],
    );
    if (allowedOperations.length === 0) {
      toast({
        title: "Pick at least one operation",
        variant: "destructive",
      });
      return;
    }
    if (
      allowedOperations.includes("approve_vendor") &&
      selectedPayees.length === 0
    ) {
      toast({
        title: "Approve vendor needs payees",
        description: "Add at least one payee or disable this operation.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const resp = await fetch(`/api/agents/${agentId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          perPaymentLimitUsd: Number(perPayment),
          monthlyLimitUsd: Number(monthly),
          payeeIds: selectedPayees,
          allowedOperations,
        }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Couldn't create permission");
      setCredentials({ payload: body.credentials, name });
      toast({
        title: "Permission created",
        description: "Copy the credentials before closing.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Couldn't create permission",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function onAck() {
    setCredentials(null);
    router.push(`/dashboard/agents/${agentId}`);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="name">Permission name</Label>
          <Input
            id="name"
            placeholder="Support refunds"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            disabled={busy}
          />
          <p className="text-xs text-neutral-500">
            Shown on the {agentName} detail page. Used in activity logs.
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
          <Label>Allowed payees</Label>
          {payees.length === 0 ? (
            <div className="rounded-md border p-3 text-xs text-neutral-500">
              No payees on this agent yet. Add one on the Payees tab before
              creating a permission that can send to a specific recipient.
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {payees.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center justify-between p-3 text-sm cursor-pointer"
                >
                  <span>{p.label}</span>
                  <input
                    type="checkbox"
                    checked={selectedPayees.includes(p.id)}
                    onChange={(e) =>
                      setSelectedPayees((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((x) => x !== p.id),
                      )
                    }
                    disabled={busy}
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Allowed operations</Label>
          <div className="rounded-md border divide-y">
            {OPERATIONS.map((op) => (
              <label
                key={op.id}
                className="flex items-start justify-between p-3 text-sm gap-4 cursor-pointer"
              >
                <div>
                  <div className="font-medium">{op.label}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {op.body}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedOps[op.id]}
                  onChange={(e) =>
                    setSelectedOps((prev) => ({
                      ...prev,
                      [op.id]: e.target.checked,
                    }))
                  }
                  disabled={busy}
                  className="mt-1 h-4 w-4"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} asChild>
            <a href={`/dashboard/agents/${agentId}`}>Cancel</a>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>Create permission</>
            )}
          </Button>
        </div>
      </form>

      {credentials ? (
        <CredentialsModal
          credentials={credentials.payload}
          permissionName={credentials.name}
          onAcknowledge={onAck}
        />
      ) : null}
    </>
  );
}
