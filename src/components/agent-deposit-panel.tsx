"use client";

import { Copy, Loader2, Plus } from "lucide-react";
import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

// INVARIANT EXCEPTION:
//   The Deposit tab renders an agent's deposit address ONLY after the
//   customer clicks "Reveal deposit address" within this dialog. The Add
//   funds tab is the default — no address ever leaks unless explicitly
//   requested. See CLAUDE.md.
export function AgentDepositPanel({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [topupAmount, setTopupAmount] = React.useState("100");
  const [topupBusy, setTopupBusy] = React.useState(false);
  const [address, setAddress] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [revealBusy, setRevealBusy] = React.useState(false);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    setTopupBusy(true);
    try {
      const resp = await fetch(`/api/agents/${agentId}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: Number(topupAmount) }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Top up failed");
      toast({
        title: `Added $${Number(topupAmount).toFixed(2)}`,
        description: `${agentName} balance updated.`,
        variant: "success",
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "Top up failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTopupBusy(false);
    }
  }

  async function reveal() {
    setRevealBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/deposit-address`, {
        cache: "no-store",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Couldn't load deposit address");
      setAddress(body.depositAddress);
      const url = await QRCode.toDataURL(body.depositAddress, {
        margin: 1,
        width: 220,
      });
      setQrDataUrl(url);
    } catch (err) {
      toast({
        title: "Couldn't load deposit address",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRevealBusy(false);
    }
  }

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast({ title: "Copied", variant: "success" });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAddress(null);
      setQrDataUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Top up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund {agentName}</DialogTitle>
          <DialogDescription>
            Add funds from a linked bank or card, or deposit stable directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="fiat" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="fiat">Add funds</TabsTrigger>
            <TabsTrigger value="crypto">Deposit</TabsTrigger>
          </TabsList>

          <TabsContent value="fiat">
            <form onSubmit={handleTopup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topupAmount">Amount (USD)</Label>
                <Input
                  id="topupAmount"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  required
                  disabled={topupBusy}
                />
              </div>
              <Button type="submit" className="w-full" disabled={topupBusy}>
                {topupBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add ${topupAmount || "0"}
                  </>
                )}
              </Button>
              <p className="text-xs text-neutral-500">
                Demo on-ramp. In production this charges a linked payment
                method.
              </p>
            </form>
          </TabsContent>

          <TabsContent value="crypto">
            {address && qrDataUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Deposit QR"
                    className="rounded-md border"
                  />
                </div>
                <div className="rounded-md border bg-neutral-50 p-3 font-mono text-xs break-all">
                  {address}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copy}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Send only supported stablecoins on the Rein settlement
                  network. Assets on a different network may be lost.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">
                  Reveal this agent&rsquo;s deposit address to send stable from
                  an external source.
                </p>
                <Button
                  onClick={reveal}
                  disabled={revealBusy}
                  className="w-full"
                >
                  {revealBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>Reveal deposit address</>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
