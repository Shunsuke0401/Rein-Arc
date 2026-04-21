"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { isAddress } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// NOTE: this form is the ONE place in the UI where an address can be typed in.
// The value is stored server-side and never rendered back to the user. All
// other views show payees by label only.
export function PayeeForm({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [address, setAddress] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(address)) {
      toast({
        title: "Invalid destination",
        description: "Paste a valid recipient.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch(`/api/agents/${agentId}/payees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, address }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Couldn't add payee");
      toast({ title: "Payee added", variant: "success" });
      setLabel("");
      setAddress("");
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't add payee",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="payee-label">Label</Label>
        <Input
          id="payee-label"
          placeholder="Stripe payouts"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          required
          disabled={busy}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payee-address">Destination</Label>
        <Input
          id="payee-address"
          placeholder="Paste the recipient here"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          disabled={busy}
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Adding…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Add payee
          </>
        )}
      </Button>
    </form>
  );
}
